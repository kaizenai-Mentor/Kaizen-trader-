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
    const mantle = require('../config/mantle');

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
    const totalSessions = await Journal.countDocuments({ user: user._id });

    let mantleEvents = 0;
    let mantleUserStats = { currentScore: 0, sessionCount: 0, milestoneCount: 0 };
    try {
      const totals = await mantle.getTotalEvents();
      mantleEvents = totals.total || 0;
      mantleUserStats = await mantle.getUserStats(user._id);
    } catch (mErr) {
      console.error('Mantle fetch error on ZA link:', mErr.message);
    }

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
      mantleEvents,
      mantleUserStats,
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

// GET /za/reputation/:userId
const getReputation = async (req, res) => {
  try {
    const User = require('../models/User');
    const Journal = require('../models/Journal');
    const mantle = require('../config/mantle');
    const user = await User.findById(req.params.userId);

    if (!user) return res.redirect('/dashboard');

    const totalSessions = await Journal.countDocuments({ user: user._id });

    let mantleEvents = 0;
    let mantleUserStats = { currentScore: 0, sessionCount: 0, milestoneCount: 0 };
    try {
      const totals = await mantle.getTotalEvents();
      mantleEvents = totals.total || 0;
      mantleUserStats = await mantle.getUserStats(user._id);
    } catch (mErr) {
      console.error('Mantle fetch error on reputation:', mErr.message);
    }

        // Award any newly-earned badges before rendering so badges stay in sync
    // with the score number.
    try {
      const checkBadges = require('../config/checkBadges');
      await checkBadges(user._id);
      const fresh = await User.findById(user._id);
      if (fresh) { user.badges = fresh.badges; user.disciplineScore = fresh.disciplineScore; user.streak = fresh.streak; }
    } catch (bErr) { console.error('Badge check error on reputation:', bErr.message); }

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
      mantleEvents,
      mantleUserStats,
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

module.exports = {
  getBounties,
  getBountyById,
  getReputation,
  linkZaAccount,
  unlinkZaAccount,
  parseZaLinkInput,
  selectZaUser
};
