const zaClient = require('../config/za');

const BOUNTIES_ENDPOINT = '/bounties';
const USERS_ENDPOINT = '/users';

function logZaError(label, error) {
  const status = error && error.response ? error.response.status : undefined;
  const url = error && error.config
    ? `${error.config.baseURL || ''}${error.config.url || ''}`
    : undefined;

  console.error(`${label}:`, {
    status: status || 'network',
    url,
    message: error && error.message ? error.message : String(error)
  });
}

function renderBounties(res, req, bounties, error) {
  return res.render('bounties', {
    user: req.session.user,
    bounties: Array.isArray(bounties) ? bounties : [],
    error: error || null
  });
}

// GET /za/bounties
const getBounties = async (req, res) => {
  try {
    // The current ZA API is the JSON route /api/bounties. config/za.js
    // normalizes ZA_BASE_URL so this remains correct when only the host is
    // supplied in the environment.
    const response = await zaClient.get(BOUNTIES_ENDPOINT);
    const bounties = zaClient.extractCollection(response.data, ['data', 'bounties']);

    return renderBounties(res, req, bounties, null);
  } catch (error) {
    logZaError('ZA Bounties error', error);
    return renderBounties(
      res,
      req,
      [],
      error && error.response && error.response.status === 404
        ? 'Zero Authority’s bounties API is temporarily unavailable. Please try again later.'
        : 'Unable to load bounties right now. Please try again later.'
    );
  }
};

// GET /za/bounties/:id
const getBountyById = async (req, res) => {
  try {
    const bountyId = encodeURIComponent(req.params.id);
    const response = await zaClient.get(`${BOUNTIES_ENDPOINT}/${bountyId}`);
    const bounty = zaClient.extractEntity(response.data, ['data', 'bounty']);

    return res.render('bounty-detail', {
      user: req.session.user,
      bounty: bounty || {}
    });
  } catch (error) {
    logZaError('ZA Bounty detail error', error);
    return res.render('bounty-detail', {
      user: req.session.user,
      bounty: {}
    });
  }
};

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .replace(/[\s_-]/g, '')
    .toLowerCase();
}

/**
 * Extract a ZA user id from arbitrary user input. Accepts:
 *   - Plain user IDs (numeric or cuid-style strings)
 *   - Profile URLs like https://zeroauthoritydao.com/profile/<id-or-username>
 *   - @username or bare usernames (we return { by: 'username', value })
 *
 * Returns { by: 'id'|'username', value } or null for unparseable input.
 */
function parseZaLinkInput(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;

  // Profile URL
  const urlMatch = input.match(/zeroauthoritydao\.com\/profile\/([^/?#]+)/i);
  if (urlMatch) {
    const segment = decodeURIComponent(urlMatch[1]).trim();
    if (/^\d+$/.test(segment)) return { by: 'id', value: segment };
    // Non-numeric segments are usernames.
    return { by: 'username', value: normalizeUsername(segment) };
  }

  // Numeric-only input is treated as an id.
  if (/^\d+$/.test(input)) return { by: 'id', value: input };

  // Strip leading @ to treat as a username.
  const name = input.replace(/^@/, '').trim();
  if (name) return { by: 'username', value: normalizeUsername(name) };

  return null;
}

async function lookupZaUser(parsed) {
  if (!parsed) return null;

  if (parsed.by === 'id') {
    // Try direct user-by-id endpoint first; fall back to search by username.
    try {
      const direct = await zaClient.get(`${USERS_ENDPOINT}/${encodeURIComponent(parsed.value)}`);
      const entity = zaClient.extractEntity(direct.data, ['data', 'user']);
      if (entity && (entity.id || entity.username)) return entity;
    } catch (err) {
      logZaError('ZA user-by-id lookup failed (continuing to search)', err);
    }
  }

  const response = await zaClient.get(USERS_ENDPOINT, {
    params: { search: parsed.value, limit: 5, includeStats: true }
  });
  const results = zaClient.extractCollection(response.data, ['users', 'data']);
  if (!results.length) return null;

  // Exact match preferred.
  if (parsed.by === 'username') {
    const exact = results.find(function (c) {
      return normalizeUsername(c && c.username) === parsed.value;
    });
    if (exact) return exact;
  }
  // If we looked up by id and the direct fetch failed, search results should
  // still contain the match when the id is returned on the record.
  if (parsed.by === 'id') {
    const byId = results.find(function (c) { return c && String(c.id) === String(parsed.value); });
    if (byId) return byId;
  }
  return results[0];
}

function selectZaUser(results, user) {
  if (!Array.isArray(results) || !results.length) return null;
  user = user || {};

  if (user.zaUserId) {
    const byId = results.find(candidate => candidate && candidate.id === user.zaUserId);
    if (byId) return byId;
  }

  // The API applies the search filter. Prefer an exact normalized username
  // when it is present, but retain the first result for older API responses
  // that only return a ranked match.
  const normalizedUsername = normalizeUsername(user.username);
  return results.find(candidate => {
    return normalizeUsername(candidate && candidate.username) === normalizedUsername;
  }) || results[0];
}

// POST /za/link  — direct account linking form submission
const linkZaAccount = async (req, res) => {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');

    const { zaInput } = req.body || {};
    const parsed = parseZaLinkInput(zaInput);

    let linkError = null;
    let zaData = null;

    if (!parsed) {
      linkError = 'Please enter your Zero Authority user ID, @username, or profile URL.';
    } else {
      try {
        const matched = await lookupZaUser(parsed);
        if (!matched || !matched.id) {
          linkError = 'We couldn’t find a Zero Authority profile matching that. Double-check your user ID or profile URL.';
        } else {
          // Prevent two KAIZEN accounts from claiming the same ZA id.
          const existing = await User.findOne({ zaUserId: String(matched.id), _id: { $ne: req.session.user.id } });
          if (existing) {
            linkError = 'This Zero Authority account is already linked to another KAIZEN profile.';
          } else {
            await User.findByIdAndUpdate(req.session.user.id, { zaUserId: String(matched.id) });
            req.session.user.zaUserId = String(matched.id);
            zaData = matched;
          }
        }
      } catch (err) {
        logZaError('ZA link lookup error', err);
        linkError = 'Unable to reach Zero Authority right now. Please try again in a moment.';
      }
    }

    // Reload fresh reputation page data, same shape as getReputation.
    const user = await User.findById(req.session.user.id);
    const totalSessions = await Journal.countDocuments({ userId: user._id });

    const mantleProfile = await fetchMantleProfile(user._id);

    if (!zaData && user.zaUserId && !linkError) {
      // If we already have a stored id (link succeeded above via matched, but
      // re-assign for clarity) — zaData was set in the success branch.
    }

    // Auto-load the freshly-linked profile when link succeeded.
    if (!zaData && !linkError && user.zaUserId) {
      try {
        const response = await zaClient.get(USERS_ENDPOINT, {
          params: { search: normalizeUsername(user.username), limit: 5, includeStats: true }
        });
        const results = zaClient.extractCollection(response.data, ['users', 'data']);
        zaData = selectZaUser(results, user);
      } catch (err) {
        logZaError('ZA post-link lookup error', err);
      }
    }

    return res.render('reputation', {
      user: req.session.user,
      profileUser: user,
      disciplineScore: user.disciplineScore || 0,
      totalSessions,
      streak: user.streak || 0,
      mantleEvents: mantleProfile.events,
      mantleUserStats: mantleProfile.userStats,
      mantleRecent: mantleProfile.recent,
      mantleNote: mantleProfile.note,
      mantleNetwork: mantleProfile.network,
      mantleExplorer: mantleProfile.explorer,
      zaData,
      reputation: zaData,
      linkError,
      linkSuccess: !!(zaData && zaData.id)
    });
  } catch (error) {
    logZaError('ZA link error', error);
    return res.redirect('/za/reputation/' + req.session.user.id);
  }
};

// POST /za/unlink  — remove the linked ZA account
const unlinkZaAccount = async (req, res) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.session.user.id, { $set: { zaUserId: '' } });
    req.session.user.zaUserId = '';
    return res.redirect('/za/reputation/' + req.session.user.id);
  } catch (error) {
    logZaError('ZA unlink error', error);
    return res.redirect('/za/reputation/' + req.session.user.id);
  }
};

/**
 * Shared Mantle data for the reputation page (reads only — no private key
 * needed). Includes recent on-chain records and merges verified KAIZEN
 * session/milestone records so logged sessions and milestones always count.
 */
async function fetchMantleProfile(userId, localContext = {}) {
  const mantle = require('../config/mantle');
  const localUser = localContext.user || null;
  const localSessions = Array.isArray(localContext.recentSessions) ? localContext.recentSessions : [];
  const recordedCount = typeof localContext.recordedCount === 'number'
    ? localContext.recordedCount
    : localSessions.length;
  const badgeList = (localUser && Array.isArray(localUser.badges)) ? localUser.badges : [];
  const localScore = (localUser && typeof localUser.disciplineScore === 'number') ? localUser.disciplineScore : 0;

  const profile = {
    events: recordedCount + badgeList.length,
    userStats: {
      currentScore: localScore,
      sessionCount: recordedCount,
      milestoneCount: badgeList.length
    },
    recent: [],
    note: null,
    network: null,
    explorer: mantle.explorerBase()
  };
  try {
    const [totals, userStats, recent, status] = await Promise.all([
      mantle.getTotalEvents(),
      mantle.getUserStats(userId),
      mantle.getRecentEvents({ userId, limit: 8 }),
      mantle.getStatus()
    ]);
    const onChainScore = (userStats && userStats.currentScore) || 0;
    const onChainSessions = (userStats && userStats.sessionCount) || 0;
    const onChainMilestones = (userStats && userStats.milestoneCount) || 0;
    const localTotalEvents = recordedCount + badgeList.length;

    profile.userStats = {
      currentScore: localScore > 0 ? localScore : onChainScore,
      sessionCount: Math.max(onChainSessions, recordedCount),
      milestoneCount: Math.max(onChainMilestones, badgeList.length)
    };
    profile.events = Math.max(totals.total || 0, onChainSessions + onChainMilestones, localTotalEvents);
    profile.recent = Array.isArray(recent) && recent.length ? recent : [];
    profile.network = status.network || 'Mantle Sepolia (testnet)';

    // If the user has logged V2 sessions or earned badges that aren't in the recent RPC log window,
    // surface them in the Recent Records feed so every session and milestone is visibly counted.
    if (profile.recent.length === 0 && (localSessions.length > 0 || badgeList.length > 0)) {
      const synthesized = [];
      for (const s of localSessions.slice(0, 6)) {
        const sc = (typeof s.sessionScore === 'number' && s.sessionScore > 0) ? s.sessionScore : localScore;
        const reason = s.ruleCompliance === false ? 'Rule violation' : 'Compliant session';
        const pairLabel = s.asset ? `${s.asset} · ${reason}` : reason;
        synthesized.push({
          type: 'Score',
          label: `${sc}% — ${pairLabel}`,
          ts: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
          txHash: null
        });
      }
      for (const b of badgeList.slice(0, 3)) {
        const badgeName = typeof b === 'string' ? b : (b && (b.name || b.id)) || 'Milestone';
        synthesized.push({
          type: 'Milestone',
          label: `${String(badgeName).replace(/_/g, ' ')} at ${localScore}%`,
          ts: (b && b.earnedAt) ? new Date(b.earnedAt).getTime() : Date.now(),
          txHash: null
        });
      }
      profile.recent = synthesized.slice(0, 8);
    }

    // Trigger non-blocking on-chain catch-up if user has local sessions not yet reflected on-chain
    if (recordedCount > onChainSessions && localScore > 0) {
      Promise.resolve().then(async () => {
        try {
          await mantle.recordScoreChange(userId, onChainScore || 50, localScore, 'Verified session sync');
        } catch (_) {}
      });
    }

    if (profile.events === 0) {
      // Explain the zero honestly (server-side issue strings stay in logs;
      // the user-facing note stays plain, no blockchain jargon).
      if (!status.contractAddress) {
        profile.note = 'On-chain recording is not connected yet.';
      } else if (status.contractHasCode === false) {
        profile.note = 'On-chain recording points at a contract this network cannot find — the address and the network do not match.';
      } else if (status.chainId === 5003 || status.chainId === 5000) {
        profile.note = 'No records on-chain yet. Records appear here as they are earned and recorded.';
      } else {
        profile.note = 'On-chain recording is not connected right now.';
      }
    }
  } catch (mErr) {
    console.error('Mantle fetch error:', mErr.message);
    if (profile.events === 0) {
      profile.note = 'On-chain records could not be read right now.';
    }
  }
  return profile;
}

// GET /za/reputation/:userId
const getReputation = async (req, res) => {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');
    const user = await User.findById(req.params.userId);

    if (!user) return res.redirect('/dashboard');

    const totalSessions = await Journal.countDocuments({ userId: user._id });
    let recentSessions = [];
    let system = null;
    let dossier = null;

    // Award any newly-earned badges and sync KAIZEN Score before rendering so
    // Reputation and Mantle counters stay in sync with Dashboard and My Progress.
    try {
      const TradingSystem = require('../models/TradingSystem');
      const ScoreSnapshot = require('../models/ScoreSnapshot');
      const Memory = require('../models/Memory');
      const MindState = require('../models/MindState');
      const { computeScore } = require('../services/scoreEngine');
      const { runV1Extraction } = require('../services/extraction');
      const { buildAutoTraderDossier } = require('../services/brokerVerify');
      system = await TradingSystem.ensureForUser(user);
      let extracted = user.v1Evidence || null;
      if (!extracted) {
        extracted = await runV1Extraction(user, Journal) || null;
      }
      recentSessions = await Journal.find({ userId: user._id, state: { $ne: 'PLANNED' } })
        .sort({ createdAt: -1 }).limit(60).lean();
      const computed = computeScore(recentSessions, system, extracted);
      if (computed.overall !== null && computed.overall !== undefined && user.disciplineScore !== computed.overall) {
        user.disciplineScore = computed.overall;
        await user.save();
        await ScoreSnapshot.create({
          userId: user._id,
          formulaVersion: computed.formulaVersion,
          overall: computed.overall,
          overallState: computed.overallState,
          dimensions: computed.dimensions,
          evidenceMix: computed.evidenceMix,
          sessionsConsidered: computed.sessionsConsidered
        }).catch(() => {});
      }
      const checkBadges = require('../config/checkBadges');
      await checkBadges(user._id);
      const fresh = await User.findById(user._id);
      if (fresh) { user.badges = fresh.badges; user.disciplineScore = fresh.disciplineScore; user.streak = fresh.streak; user.brokerTrades = fresh.brokerTrades; }

      const [memories, mindState] = await Promise.all([
        Memory.find({ userId: user._id }).sort({ createdAt: -1 }).limit(15).lean().catch(() => []),
        MindState.findOne({ userId: user._id }).lean().catch(() => null)
      ]);
      dossier = buildAutoTraderDossier({
        user,
        system,
        sessions: recentSessions,
        memories,
        mindState,
        score: computed
      });
    } catch (bErr) { console.error('Badge/score check error on reputation:', bErr.message); }

    const mantleProfile = await fetchMantleProfile(user._id, {
      user,
      recordedCount: recentSessions.length || totalSessions,
      recentSessions
    });

    let zaData = null;
    const searchName = normalizeUsername(user.username);

    if (!zaData && searchName) {
      try {
        // The live API exposes /api/users and returns { users: [...] }.
        // /api/search/users is not a route and consistently returns 404, so
        // do not call it as a fallback.
        const response = await zaClient.get(USERS_ENDPOINT, {
          params: { search: searchName, limit: 5, includeStats: true }
        });
        const results = zaClient.extractCollection(response.data, ['users', 'data']);
        zaData = selectZaUser(results, user);

        if (zaData && typeof zaData.username === 'string') zaData.username = zaData.username.trim();

        if (zaData) {
          console.log('ZA found via users endpoint:', zaData.username || zaData.id);
        } else {
          console.log('ZA: no profile found for:', searchName);
        }
      } catch (error) {
        // Reputation is supplementary; keep the page usable when ZA is down.
        logZaError('ZA user lookup error', error);
      }
    }

    return res.render('reputation', {
      user: req.session.user,
      profileUser: user,
      disciplineScore: user.disciplineScore || 0,
      totalSessions,
      streak: user.streak || 0,
      mantleEvents: mantleProfile.events,
      mantleUserStats: mantleProfile.userStats,
      mantleRecent: mantleProfile.recent,
      mantleNote: mantleProfile.note,
      mantleNetwork: mantleProfile.network,
      mantleExplorer: mantleProfile.explorer,
      dossier,
      importedCount: req.query.imported !== undefined ? Number(req.query.imported) : null,
      zaData,
      reputation: zaData,
      linkError: null,
      linkSuccess: false
    });
  } catch (error) {
    logZaError('Reputation page error', error);
    return res.redirect('/dashboard');
  }
};

// GET /za/reputation/:userId/dossier.pdf
const downloadDossierPdf = async (req, res) => {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');
    const TradingSystem = require('../models/TradingSystem');
    const Memory = require('../models/Memory');
    const MindState = require('../models/MindState');
    const { computeScore } = require('../services/scoreEngine');
    const { runV1Extraction } = require('../services/extraction');
    const { buildAutoTraderDossier } = require('../services/brokerVerify');
    const { generateDossierPdfBuffer } = require('../services/pdfDossier');

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).send('Trader not found');

    const system = await TradingSystem.ensureForUser(user);
    let extracted = user.v1Evidence || null;
    if (!extracted) {
      extracted = await runV1Extraction(user, Journal) || null;
    }
    const [recentSessions, memories, mindState] = await Promise.all([
      Journal.find({ userId: user._id, state: { $ne: 'PLANNED' } }).sort({ createdAt: -1 }).limit(60).lean(),
      Memory.find({ userId: user._id }).sort({ createdAt: -1 }).limit(15).lean().catch(() => []),
      MindState.findOne({ userId: user._id }).lean().catch(() => null)
    ]);
    const computed = computeScore(recentSessions, system, extracted);
    const dossier = buildAutoTraderDossier({
      user,
      system,
      sessions: recentSessions,
      memories,
      mindState,
      score: computed
    });

    const pdfBuf = generateDossierPdfBuffer(dossier, {
      redactPairs: req.query.redactPairs === '1',
      redactDates: req.query.redactDates === '1',
      hideQuotes: req.query.hideQuotes === '1'
    });

    const safeName = String(user.username || 'Trader').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="KAIZEN-Trader-Certificate-${safeName}.pdf"`);
    res.setHeader('Content-Length', String(pdfBuf.length));
    return res.send(pdfBuf);
  } catch (err) {
    console.error('downloadDossierPdf error:', err.message);
    return res.redirect('/za/reputation/' + req.params.userId);
  }
};

module.exports = {
  getBounties,
  getBountyById,
  getReputation,
  downloadDossierPdf,
  linkZaAccount,
  unlinkZaAccount,
  parseZaLinkInput,
  selectZaUser
};
