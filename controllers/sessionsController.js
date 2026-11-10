/**
 * Sessions Controller — V2 core loop (config/App.js B5, config/AppCopy.js §2).
 * PLAN → RECORD → REFLECT → ANALYZE, plus the legacy journal bridge.
 */
const multer = require('multer');
const User = require('../models/User');
const Journal = require('../models/Journal'); // = Session model, same collection
const TradingSystem = require('../models/TradingSystem');
const ScoreSnapshot = require('../models/ScoreSnapshot');
const { computeScore } = require('../services/scoreEngine');
const { runV1Extraction } = require('../services/extraction');
const aiCoach = require('../services/aiCoach');
const checkBadges = require('../config/checkBadges');
const { syncSessionFeedback } = require('../services/sessionGoalFeedback');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
  }
});

const DIMENSION_LABELS = {
  process: 'Process', risk: 'Risk', execution: 'Execution',
  behavior: 'Behavior', learning: 'Learning'
};

async function loadOwned(req, res) {
  const s = await Journal.findOne({ _id: req.params.id, userId: req.session.user.id });
  if (!s) {
    res.status(404).redirect('/dashboard/sessions');
    return null;
  }
  return s;
}

// ── BROKER 1-TO-1 VERIFICATION HELPER ────────────────────────────
// Enforces that one MT5/broker trade (tradeHash) can verify at most ONE session.
// Also auto-heals any historical sessions that accidentally shared the same tradeHash.
async function getClaimedTradeHashes(userId, excludeSessionId = null) {
  const claimed = new Set();
  try {
    const verifiedDocs = await Journal.find({
      userId,
      'brokerVerification.status': 'VERIFIED',
      'brokerVerification.tradeHash': { $exists: true, $ne: '' }
    }).sort({ createdAt: 1 });

    const seenHashes = new Set();
    for (const doc of verifiedDocs) {
      const h = String((doc.brokerVerification && doc.brokerVerification.tradeHash) || '').trim();
      if (!h) continue;
      if (seenHashes.has(h)) {
        // Duplicate tradeHash on a later session: release it so 1-to-1 integrity holds
        doc.brokerVerification = {
          status: 'UNVERIFIED',
          tradeHash: '',
          matchedInstrument: '',
          matchedDirection: '',
          entryPrice: '',
          exitPrice: '',
          openTime: null,
          closeTime: null,
          verifiedAt: null
        };
        await doc.save().catch(() => {});
        continue;
      }
      seenHashes.add(h);
      if (!excludeSessionId || String(doc._id) !== String(excludeSessionId)) {
        claimed.add(h);
      }
    }
  } catch (_) { /* non-fatal */ }
  return claimed;
}

function inferOutcomeFromNotesText(notes = '') {
  const s = String(notes || '');
  if (!s) return null;
  if (/\b(stopped\s+out|hit\s+(my\s+)?(stop|sl)|sl\s+hit|took\s+a\s+loss|closed\s+(in\s+|at\s+a\s+)?loss|lost\s+on|full\s+loss)\b/i.test(s)) {
    return 'Loss';
  }
  if (/\b(hit\s+(my\s+)?(tp|take\s+profit|target)|tp\s+hit|target\s+hit|closed\s+in\s+profit|won\s+the\s+trade|clean\s+win|banked\s+profit)\b/i.test(s)) {
    return 'Win';
  }
  if (/\b(break\s*even|stopped\s+at\s+be|closed\s+at\s+be)\b/i.test(s)) {
    return 'Breakeven';
  }
  return null;
}

// ── LIST ─────────────────────────────────────────────────────────
async function getSessions(req, res) {
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  await getClaimedTradeHashes(req.session.user.id);
  const sessions = await Journal.find({ userId: req.session.user.id })
    .sort({ createdAt: -1 }).limit(60).lean();
  const openPlan = sessions.find(s => s.state === 'PLANNED');
  const brokerTradesCount = (userDoc && Array.isArray(userDoc.brokerTrades)) ? userDoc.brokerTrades.length : 0;
  const importedCount = req.query.imported !== undefined ? Number(req.query.imported) : null;
  res.render('sessions', {
    user: req.session.user, sessions, openPlan, system,
    brokerTradesCount, importedCount,
    title: 'Sessions'
  });
}

// ── STAGE 1: PLAN ────────────────────────────────────────────────
async function getPlan(req, res) {
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  const type = ['LIVE', 'BACKTEST', 'STUDY'].includes(req.query.type) ? req.query.type : 'LIVE';
  res.render('session-plan', {
    user: req.session.user, system, type, title: 'New Session — The Plan'
  });
}

async function postPlan(req, res) {
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  const type = ['LIVE', 'BACKTEST', 'STUDY'].includes(req.body.sessionType) ? req.body.sessionType : 'LIVE';
  const skipped = req.body.skip === '1';

  // Custom-setup reveal box: 'CUSTOM' swaps to the revealed customSetup input.
  const setupValue = req.body.setup === 'CUSTOM'
    ? String(req.body.customSetup || '').trim()
    : String(req.body.setup || '').trim();

  // Custom-risk reveal box: 'CUSTOM' or 'DIFFERENT' swaps to the revealed customRisk input.
  const predefinedRisk = (req.body.predefinedRisk === 'CUSTOM' || req.body.predefinedRisk === 'DIFFERENT')
    ? String(req.body.customRisk || '').trim()
    : String(req.body.predefinedRisk || '').trim();

  // Never store the strategy/setup name into `asset` (pair/instrument).
  const explicitPair = String(req.body.asset || '').trim();
  const detectedPair = aiCoach.extractInstrumentFromText(
    [explicitPair, req.body.entryCondition, req.body.invalidation].filter(Boolean).join(' ')
  );
  const resolvedAsset = skipped
    ? 'General'
    : (detectedPair || (explicitPair && explicitPair.toLowerCase() !== setupValue.toLowerCase() ? explicitPair.toUpperCase() : 'General'));

  const session = new Journal({
    userId: req.session.user.id,
    sessionType: type,
    state: 'PLANNED',
    plan: {
      setup: skipped ? '' : setupValue,
      entryCondition: skipped ? '' : (req.body.entryCondition || ''),
      invalidation: skipped ? '' : (req.body.invalidation || ''),
      predefinedRisk: skipped ? '' : predefinedRisk,
      emotionalState: skipped ? '' : (req.body.emotionalState || ''),
      confidence: skipped ? null : (parseInt(req.body.confidence, 10) || null),
      skipped,
      systemVersion: system.version,
      createdAt: new Date()
    },
    asset: resolvedAsset,
    notes: '',
    emotion: skipped ? 'Neutral' : (req.body.emotionalState || 'Neutral')
  });
  await session.save();
  res.redirect(`/dashboard/sessions/${session._id}/record`);
}

// ── STAGE 2: RECORD ──────────────────────────────────────────────
async function getRecord(req, res) {
  const session = await loadOwned(req, res);
  if (!session) return;
  if (session.state !== 'PLANNED') {
    return res.redirect(`/dashboard/sessions/${session._id}`);
  }
  res.render('session-record', {
    user: req.session.user, session, title: 'The Record'
  });
}

const CHECK_FIELDS = ['followedPlan', 'withinEntryCriteria', 'respectedRisk'];

async function postRecord(req, res) {
  const session = await loadOwned(req, res);
  if (!session) return;
  if (session.state !== 'PLANNED') {
    return res.redirect(`/dashboard/sessions/${session._id}`);
  }

  const notes = (req.body.notes || '').trim();
  if (!notes) {
    return res.redirect(`/dashboard/sessions/${session._id}/record`);
  }

  const actualRiskNote = req.body.actualRisk && String(req.body.actualRisk).trim()
    ? ` (Actual risk used: ${String(req.body.actualRisk).trim()})`
    : '';
  session.notes = notes + (actualRiskNote && !notes.includes(String(req.body.actualRisk).trim()) ? actualRiskNote : '');
  const ctxAtRecord = aiCoach.resolveSessionContext({
    sessionType: session.sessionType,
    asset: req.body.asset || session.asset,
    plan: session.plan,
    notes: session.notes
  });
  if (ctxAtRecord.isStudyOrBacktest && session.sessionType === 'LIVE') {
    session.sessionType = 'STUDY';
  }
  session.asset = ctxAtRecord.instrument || (req.body.asset && String(req.body.asset).trim()) || (session.sessionType === 'STUDY' ? 'Market Study' : 'General');
  session.timeframe = req.body.timeframe || 'N/A';
  session.direction = `${session.sessionType} Session`;
  if (req.body.outcome && ['Win', 'Loss', 'Breakeven', 'No Trade'].includes(req.body.outcome)) {
    session.outcome = req.body.outcome;
  } else if (session.sessionType !== 'STUDY') {
    const inferredOut = inferOutcomeFromNotesText(session.notes);
    if (inferredOut) session.outcome = inferredOut;
  }
  if (req.body.rrAchieved) session.rrAchieved = req.body.rrAchieved;
  if (req.body.pipsGained) session.pipsGained = req.body.pipsGained;

  // Support single or multiple chart image uploads (up to 8 screenshots per session)
  const uploadedFiles = [];
  if (req.files) {
    if (Array.isArray(req.files)) {
      uploadedFiles.push(...req.files);
    } else {
      if (Array.isArray(req.files.chartImage)) uploadedFiles.push(...req.files.chartImage);
      if (Array.isArray(req.files.chartImages)) uploadedFiles.push(...req.files.chartImages);
    }
  }
  if (req.file && !uploadedFiles.includes(req.file)) {
    uploadedFiles.push(req.file);
  }
  const validUploads = uploadedFiles.filter(f => f && f.buffer && f.mimetype).slice(0, 8);
  if (validUploads.length > 0) {
    // Owner-only screenshots: bytes stored on the session document itself.
    session.hasChartImage = true;
    session.chartImage = { data: validUploads[0].buffer, contentType: validUploads[0].mimetype };
    session.chartImages = validUploads.map(f => ({ data: f.buffer, contentType: f.mimetype }));
  }

  const q = session.quickChecks || {};
  const values = {
    followedPlan: ['YES', 'NO', 'NO_PLAN', 'NOT_MENTIONED'],
    withinEntryCriteria: ['YES', 'NO', 'NOT_MENTIONED'],
    respectedRisk: ['YES', 'NO', 'NOT_MENTIONED']
  };
  for (const f of CHECK_FIELDS) {
    q[f] = values[f].includes(req.body[f]) ? req.body[f] : 'NOT_MENTIONED';
  }
  // STUDY sessions have no trade checks — silence is silence
  if (session.sessionType === 'STUDY') {
    q.followedPlan = 'NOT_MENTIONED';
    q.withinEntryCriteria = 'NOT_MENTIONED';
    q.respectedRisk = 'NOT_MENTIONED';
    session.outcome = 'No Trade';
  }
  const interpAtRecord = aiCoach.interpretJournal(session);
  // If the trader left quick checks untouched on the form, infer sensible defaults
  // from their written journal notes & interpretation so every recorded session counts.
  if (session.sessionType !== 'STUDY') {
    if (q.followedPlan === 'NOT_MENTIONED') {
      if (session.plan && session.plan.skipped) q.followedPlan = 'NO_PLAN';
      else q.followedPlan = interpAtRecord.isEmotionalDeviation ? 'NO' : 'YES';
    }
    if (q.withinEntryCriteria === 'NOT_MENTIONED' && !(session.plan && session.plan.skipped)) {
      q.withinEntryCriteria = interpAtRecord.isEmotionalDeviation ? 'NO' : 'YES';
    }
    if (q.respectedRisk === 'NOT_MENTIONED') {
      const brokeRiskNotes = /\b((doubled|increased|added\s+to)\s+(my\s+)?(position|risk)|oversized|too\s+big|blew|exceeded\s+risk|moved?\s+(my\s+)?(stop|sl)|widened?\s+(my\s+)?stop)\b/i.test(notes);
      q.respectedRisk = brokeRiskNotes ? 'NO' : 'YES';
    }
  }
  // Preserve only the trader's submitted answers separately from inferred checks.
  session.reportedChecks = Object.fromEntries(CHECK_FIELDS.map(f => [f, values[f].includes(req.body[f]) ? req.body[f] : 'NOT_MENTIONED']));
  session.quickChecks = q;
  const anyRuleBroken = q.followedPlan === 'NO' || q.withinEntryCriteria === 'NO' || q.respectedRisk === 'NO';
  session.ruleCompliance = interpAtRecord.isPlanRevision
    ? (q.withinEntryCriteria !== 'NO' && q.respectedRisk !== 'NO')
    : !anyRuleBroken;
  session.state = 'RECORDED';

  // Novelty guard (B6b): near-duplicate consecutive text earns reduced
  // reflection credit — flagged deterministically here.
  const prev = await Journal.findOne({
    userId: req.session.user.id, _id: { $ne: session._id }
  }).sort({ createdAt: -1 });
  if (prev && prev.notes && similarity(prev.notes, notes) > 0.9) {
    session.evidenceFlags.duplicateOf = prev._id;
  }

  await session.save();
  await syncSessionFeedback(req.session.user.id, session).catch(err => console.error('session goal sync:', err.message));

  // Compute live KAIZEN Score, persist ScoreSnapshot, and update streak + disciplineScore + badges
  try {
    const userDoc = await User.findById(req.session.user.id);
    const system = await TradingSystem.ensureForUser(userDoc);

    // 1-to-1 Broker Verification at record time
    if (session.sessionType === 'LIVE' && userDoc) {
      const brokerVerify = require('../services/brokerVerify');
      const claimedHashes = await getClaimedTradeHashes(req.session.user.id, session._id);
      const bCheck = brokerVerify.matchSessionWithBrokerHistory(
        session,
        Array.isArray(userDoc.brokerTrades) ? userDoc.brokerTrades : [],
        userDoc.brokerConnection || null,
        claimedHashes
      );
      if (bCheck.verified && bCheck.matchedTrade) {
        session.brokerVerification = {
          status: 'VERIFIED',
          tradeHash: bCheck.matchedTrade.tradeHash || '',
          matchedInstrument: bCheck.matchedTrade.instrument || '',
          matchedDirection: bCheck.matchedTrade.direction || '',
          entryPrice: bCheck.matchedTrade.entryPrice || '',
          exitPrice: bCheck.matchedTrade.exitPrice || '',
          openTime: bCheck.matchedTrade.openTime || null,
          closeTime: bCheck.matchedTrade.closeTime || null,
          verifiedAt: new Date()
        };
        await session.save().catch(() => {});
      }
    }

    const all = await Journal.find({ userId: req.session.user.id, state: { $ne: 'PLANNED' } })
      .sort({ createdAt: -1 });
    let extracted = userDoc.v1Evidence || null;
    if (!extracted) {
      extracted = await runV1Extraction(userDoc, Journal) || null;
    }
    const score = computeScore(all.slice(0, 25), system, extracted);
    await ScoreSnapshot.create({
      userId: req.session.user.id,
      formulaVersion: score.formulaVersion,
      overall: score.overall,
      overallState: score.overallState,
      dimensions: score.dimensions,
      evidenceMix: score.evidenceMix,
      sessionsConsidered: score.sessionsConsidered
    });

    if (score.overall !== null && score.overall !== undefined) {
      const prevScore = userDoc.disciplineScore || 50;
      userDoc.disciplineScore = score.overall;
      session.sessionScore = score.overall;
      await session.save();

      // Non-blocking Mantle on-chain recording for V2 recorded sessions
      Promise.resolve().then(async () => {
        try {
          const mantle = require('../config/mantle');
          await mantle.recordScoreChange(
            userDoc._id,
            prevScore,
            score.overall,
            session.ruleCompliance !== false ? 'Compliant session' : 'Rule violation'
          );
          if ([1, 5, 10, 25, 50, 100].includes(all.length)) {
            await mantle.recordMilestone(userDoc._id, `${all.length}_sessions`, score.overall);
          }
          if (score.overall >= 80 && prevScore < 80) {
            await mantle.recordMilestone(userDoc._id, 'elite_tier_reached', score.overall);
          }
        } catch (mErr) {
          console.error('Mantle V2 record error:', mErr.message);
        }
      });
    }

    // Update daily streak on compliant session
    const compliant = session.ruleCompliance !== false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const prevSession = all.find(s => String(s._id) !== String(session._id));
    if (compliant) {
      if (prevSession && prevSession.createdAt) {
        const lastDate = new Date(prevSession.createdAt); lastDate.setHours(0, 0, 0, 0);
        if (lastDate.getTime() === yesterday.getTime()) {
          userDoc.streak = (userDoc.streak || 0) + 1;
        } else if (lastDate.getTime() !== today.getTime()) {
          userDoc.streak = Math.max(userDoc.streak || 0, 1);
        } else if (!userDoc.streak) {
          userDoc.streak = 1;
        }
      } else {
        userDoc.streak = Math.max(userDoc.streak || 0, 1);
      }
    }

    await userDoc.save();
    await checkBadges(userDoc._id);

    const refreshedUser = await User.findById(req.session.user.id);
    req.session.user = {
      ...req.session.user,
      disciplineScore: (refreshedUser && refreshedUser.disciplineScore) || userDoc.disciplineScore || 0,
      streak: (refreshedUser && refreshedUser.streak) || userDoc.streak || 0,
      badges: (refreshedUser && refreshedUser.badges) || userDoc.badges || []
    };
  } catch (e) {
    console.error('postRecord score/badge/streak error:', e.message);
  }

  res.redirect(`/dashboard/sessions/${session._id}/reflect`);
}

function similarity(a, b) {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return (2 * shared) / (A.size + B.size);
}

// ── STAGE 3: REFLECT → ANALYZE ───────────────────────────────────
async function getReflect(req, res) {
  const session = await loadOwned(req, res);
  if (!session) return;
  if (session.state === 'PLANNED') {
    return res.redirect(`/dashboard/sessions/${session._id}/record`);
  }
  res.render('session-reflect', {
    user: req.session.user, session, title: 'The Reflection'
  });
}

async function postReflect(req, res) {
  const session = await loadOwned(req, res);
  if (!session) return;
  if (!['RECORDED', 'PLANNED'].includes(session.state)) {
    return res.redirect(`/dashboard/sessions/${session._id}`);
  }

  session.reflection = {
    whatHappened: (req.body.whatHappened || '').trim(),
    followedProcess: (req.body.followedProcess || '').trim(),
    learned: (req.body.learned || '').trim(),
    wouldChange: (req.body.wouldChange || '').trim(),
    completedAt: new Date()
  };
  const interpAtReflect = aiCoach.interpretJournal(session);
  const qc = session.quickChecks || {};
  const anyBroken = qc.followedPlan === 'NO' || qc.withinEntryCriteria === 'NO' || qc.respectedRisk === 'NO';
  session.ruleCompliance = interpAtReflect.isPlanRevision
    ? (qc.withinEntryCriteria !== 'NO' && qc.respectedRisk !== 'NO')
    : !anyBroken;
  session.state = 'REFLECTED';
  await session.save();
  await syncSessionFeedback(req.session.user.id, session).catch(err => console.error('session goal sync:', err.message));

  // ── ANALYZE: two machines, one response ──
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  const recentSessions = await Journal.find({ userId: req.session.user.id, state: { $ne: 'PLANNED' } })
    .sort({ createdAt: -1 }).limit(25).lean();

  // Machine 1 — deterministic engine (with one-time V1 extraction)
  let extracted = userDoc.v1Evidence || null;
  if (!extracted) {
    extracted = await runV1Extraction(userDoc, Journal) || null;
  }
  const score = computeScore(recentSessions, system, extracted);
  await ScoreSnapshot.create({
    userId: req.session.user.id,
    formulaVersion: score.formulaVersion,
    overall: score.overall,
    overallState: score.overallState,
    dimensions: score.dimensions,
    evidenceMix: score.evidenceMix,
    sessionsConsidered: score.sessionsConsidered
  });
  if (score.overall !== null && score.overall !== undefined) {
    const prevScore = userDoc.disciplineScore || 50;
    userDoc.disciplineScore = score.overall;
    session.sessionScore = score.overall;
    await userDoc.save();
    req.session.user.disciplineScore = score.overall;

    // Award badges and record on-chain Mantle events for V2 reflected sessions
    try {
      await checkBadges(userDoc._id);
      const refreshedUser = await User.findById(req.session.user.id);
      if (refreshedUser) {
        req.session.user.badges = refreshedUser.badges || [];
      }
    } catch (bErr) {
      console.error('postReflect badge error:', bErr.message);
    }

    Promise.resolve().then(async () => {
      try {
        const mantle = require('../config/mantle');
        await mantle.recordScoreChange(
          userDoc._id,
          prevScore,
          score.overall,
          session.ruleCompliance !== false ? 'Compliant reflected session' : 'Rule violation'
        );
        if ([1, 5, 10, 25, 50, 100].includes(recentSessions.length)) {
          await mantle.recordMilestone(userDoc._id, `${recentSessions.length}_sessions`, score.overall);
        }
        if (score.overall >= 80 && prevScore < 80) {
          await mantle.recordMilestone(userDoc._id, 'elite_tier_reached', score.overall);
        }
      } catch (mErr) {
        console.error('Mantle V2 reflect error:', mErr.message);
      }
    });
  }

  // Machine 2 — the coach (改): explains, never scores
  const MindState = require('../models/MindState');
  const Goal = require('../models/Goal');
  const [mindState, goals] = await Promise.all([
    MindState.ensureForUser(req.session.user.id).catch(() => null),
    Goal.find({ userId: req.session.user.id, status: 'ACTIVE' }).lean().catch(() => [])
  ]);
  const coachArgs = {
    session: session.toObject(), user: userDoc, system,
    recentSessions: recentSessions.filter(s => String(s._id) !== String(session._id)),
    mindState,
    goals
  };
  const applyExtracted = (text) => {
    const ex = aiCoach.parseExtracted(text);
    if (ex) {
      if (['Win', 'Loss', 'Breakeven', 'No Trade'].includes(ex.outcome) &&
          (session.outcome === 'Pending' || (session.outcome === 'No Trade' && ex.outcome !== 'No Trade' && session.sessionType !== 'STUDY'))) {
        session.outcome = ex.outcome;
      }
      if (ex.rr && ex.rr !== 'N/A' && !session.rrAchieved) session.rrAchieved = ex.rr;
      if (ex.pips && ex.pips !== 'N/A' && !session.pipsGained) session.pipsGained = ex.pips;
    }
    if (session.sessionType !== 'STUDY' && (!session.outcome || session.outcome === 'Pending' || session.outcome === 'No Trade')) {
      const detOut = inferOutcomeFromNotesText(session.notes);
      if (detOut) session.outcome = detOut;
    }
    return aiCoach.stripExtracted(text);
  };

  const recomputeScoreAfterAnalysis = async () => {
    try {
      const updatedSessions = await Journal.find({ userId: req.session.user.id, state: { $ne: 'PLANNED' } })
        .sort({ createdAt: -1 }).limit(25).lean();
      const postScore = computeScore(updatedSessions, system, extracted);
      const latestSnap = await ScoreSnapshot.findOne({ userId: req.session.user.id }).sort({ computedAt: -1 });
      if (latestSnap && latestSnap.sessionsConsidered === postScore.sessionsConsidered) {
        latestSnap.overall = postScore.overall;
        latestSnap.overallState = postScore.overallState;
        latestSnap.dimensions = postScore.dimensions;
        latestSnap.evidenceMix = postScore.evidenceMix;
        latestSnap.computedAt = new Date();
        await latestSnap.save().catch(() => {});
      } else {
        await ScoreSnapshot.create({
          userId: req.session.user.id,
          formulaVersion: postScore.formulaVersion,
          overall: postScore.overall,
          overallState: postScore.overallState,
          dimensions: postScore.dimensions,
          evidenceMix: postScore.evidenceMix,
          sessionsConsidered: postScore.sessionsConsidered
        }).catch(() => {});
      }
      if (postScore.overall !== null && postScore.overall !== undefined) {
        userDoc.disciplineScore = postScore.overall;
        session.sessionScore = postScore.overall;
        await userDoc.save().catch(() => {});
        if (req.session && req.session.user) {
          req.session.user.disciplineScore = postScore.overall;
        }
      }
    } catch (_) { /* non-fatal */ }
  };

  // Streaming path (SSE): the analysis arrives as it is written; the
  // EXTRACTED: tail is held back and applied server-side.
  if (String(req.body.stream) === '1') {
    const llm = require('../services/llm');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no'
    });
    if (res.flushHeaders) res.flushHeaders();
    const send = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
    send({ type: 'meta', sessionId: String(session._id) });
    const holdback = llm.createTailHoldback('EXTRACTED:');
    let full = '';
    let emitted = false;
    try {
      for await (const chunk of aiCoach.streamAnalysis(coachArgs)) {
        full += chunk;
        const safe = holdback.push(chunk);
        if (safe) { emitted = true; send({ type: 'delta', text: safe }); }
      }
      const flushed = holdback.flush();
      if (flushed.rest) send({ type: 'delta', text: flushed.rest });
    } catch (e) {
      console.error('AI coach stream error:', e.message);
      if (!emitted) {
        full = aiCoach.buildFallback(session);
        send({ type: 'delta', text: full });
      }
    }
    const visible = applyExtracted(full);
    session.aiAnalysis = visible;
    session.state = 'ANALYZED';
    await session.save();
    await recomputeScoreAfterAnalysis();
    send({ type: 'done', sessionId: String(session._id) });
    return res.end();
  }

  let coaching = '';
  try {
    coaching = applyExtracted(await aiCoach.analyzeSession(coachArgs));
  } catch (e) {
    console.error('AI coach error:', e.message);
    coaching = aiCoach.buildFallback(session);
  }

  session.aiAnalysis = coaching;
  session.state = 'ANALYZED';
  await session.save();
  await recomputeScoreAfterAnalysis();

  // Streaming path: the Reflect page fetches this and reveals the
  // analysis in place (Psychology-style); no-JS falls back to redirect.
  const wantsJson = req.xhr || String(req.body.json) === '1' ||
    (req.headers.accept || '').includes('application/json');
  if (wantsJson) {
    return res.json({ ok: true, sessionId: String(session._id), analysis: session.aiAnalysis || '' });
  }

  res.redirect(`/dashboard/sessions/${session._id}`);
}

// ── DETAIL (the ANALYZED surface) ────────────────────────────────
async function getDetail(req, res) {
  const session = await loadOwned(req, res);
  if (!session) return;

  // Auto-heal any earlier session where `session.asset` was mistakenly saved as
  // the strategy/setup name (e.g. "Daily Candlestick Liquidity") instead of the pair (e.g. "Japan 225" or "AUDJPY"),
  // or where a study/backtest session was logged under LIVE.
  const ctx = aiCoach.resolveSessionContext(session);
  const setupName = String((session.plan && session.plan.setup) || '').trim();
  const assetClean = String(session.asset || '').trim();
  const assetWasStrategy = Boolean(setupName && assetClean && assetClean.toLowerCase() === setupName.toLowerCase());
  let dirty = false;
  if (session.plan && session.plan.setup && session.plan.setup !== setupName) {
    session.plan.setup = setupName;
    dirty = true;
  }
  if (ctx.isStudyOrBacktest && session.sessionType === 'LIVE') {
    session.sessionType = 'STUDY';
    if (!session.outcome || session.outcome === 'Pending') session.outcome = 'No Trade';
    dirty = true;
  }
  if (ctx.instrument && assetClean !== ctx.instrument) {
    session.asset = ctx.instrument;
    dirty = true;
  } else if (assetWasStrategy && !ctx.instrument) {
    session.asset = ctx.isStudyOrBacktest ? 'Market Study' : 'General';
    dirty = true;
  }
  if (dirty) {
    await session.save().catch(() => {});
  }

  const [latest, recentSessions, userDoc, claimedHashes] = await Promise.all([
    ScoreSnapshot.findOne({ userId: req.session.user.id }).sort({ computedAt: -1 }).lean(),
    Journal.find({ userId: req.session.user.id, _id: { $ne: session._id } }).sort({ createdAt: -1 }).limit(10).lean(),
    User.findById(req.session.user.id).lean(),
    getClaimedTradeHashes(req.session.user.id, session._id)
  ]);
  const brokerVerify = require('../services/brokerVerify');
  const brokerTrades = (userDoc && Array.isArray(userDoc.brokerTrades)) ? userDoc.brokerTrades : [];
  const brokerConn = (userDoc && userDoc.brokerConnection) ? userDoc.brokerConnection : null;
  const brokerCheck = brokerVerify.matchSessionWithBrokerHistory(session, brokerTrades, brokerConn, claimedHashes);
  if (brokerCheck.verified && (!session.brokerVerification || session.brokerVerification.status !== 'VERIFIED')) {
    session.brokerVerification = {
      status: 'VERIFIED',
      tradeHash: brokerCheck.matchedTrade.tradeHash,
      matchedInstrument: brokerCheck.matchedTrade.instrument,
      matchedDirection: brokerCheck.matchedTrade.direction,
      entryPrice: brokerCheck.matchedTrade.entryPrice,
      exitPrice: brokerCheck.matchedTrade.exitPrice,
      openTime: brokerCheck.matchedTrade.openTime,
      closeTime: brokerCheck.matchedTrade.closeTime,
      verifiedAt: new Date()
    };
    await session.save().catch(() => {});
  }
  const chartImageCount = (Array.isArray(session.chartImages) && session.chartImages.length > 0)
    ? session.chartImages.filter(img => img && img.data).length
    : (session.hasChartImage ? 1 : 0);
  const review = aiCoach.parseSessionReview(session.aiAnalysis, session, { recentSessions });
  res.render('session-detail', {
    user: req.session.user, session, score: latest, review, brokerCheck, chartImageCount,
    dimensionLabels: DIMENSION_LABELS, title: 'Session'
  });
}

// ── BROKER STATEMENT IMPORT & ONE-TIME READ-ONLY INVESTOR PASSWORD / API LINK ──
async function postImportBroker(req, res) {
  const crypto = require('crypto');
  const brokerVerify = require('../services/brokerVerify');
  const rawFile = (req.file && req.file.buffer) ? req.file.buffer.toString('utf8') : '';
  const rawBody = String(req.body.brokerText || '').trim();

  // One-Time Read-Only Broker API Key OR Prop Firm Investor Password Link (2 side-by-side boxes)
  const rawApiKey = String(req.body.brokerApiKey || '').trim();
  const rawInvPass = String(req.body.investorPassword || '').trim();
  const invPass = rawApiKey || rawInvPass;
  const defaultPlatform = rawApiKey ? 'Read-Only Broker API Key' : 'Investor Password (Read-Only)';
  const invPlatform = String(req.body.investorPlatform || defaultPlatform).trim();
  const invServer = String(req.body.investorServer || 'Read-Only Sync').trim();
  const invLogin = String(req.body.investorLogin || '').trim();
  const hasInvestorLink = Boolean(invPass && invPass.length >= 4);

  const content = [rawFile, rawBody].filter(Boolean).join('\n');
  const rawReturnTo = (req.body.returnTo && String(req.body.returnTo).startsWith('/'))
    ? String(req.body.returnTo)
    : '/dashboard/sessions';
  const [basePath, hashFrag] = rawReturnTo.split('#');
  const buildRedirect = (count, linked = false) => {
    const sep = basePath.includes('?') ? '&' : '?';
    const extra = linked ? '&investorLinked=1' : '';
    return `${basePath}${sep}imported=${count}${extra}${hashFrag ? '#' + hashFrag : ''}`;
  };

  if (!content && !hasInvestorLink) {
    return res.redirect(buildRedirect(0));
  }

  const parsed = content
    ? brokerVerify.parseBrokerStatement(content, (req.file && req.file.originalname) || '')
    : [];
  const userDoc = await User.findById(req.session.user.id);
  if (!userDoc) return res.redirect('/dashboard/sessions');

  if (hasInvestorLink) {
    const tail = (invLogin || invPass).slice(-3);
    userDoc.brokerConnection = {
      active: true,
      platform: invPlatform || 'Read-Only Broker API Key',
      server: invServer || 'Read-Only API Sync',
      maskedAccount: `****${tail}`,
      credentialHash: crypto.createHash('sha256').update(`${invServer}:${invLogin}:${invPass}`).digest('hex'),
      connectedAt: new Date(),
      lastSkimmedAt: new Date()
    };
  }

  const existing = Array.isArray(userDoc.brokerTrades) ? userDoc.brokerTrades : [];
  const existingHashes = new Set(existing.map(t => t && t.tradeHash).filter(Boolean));
  let added = 0;
  for (const t of parsed) {
    if (!existingHashes.has(t.tradeHash)) {
      existing.push(t);
      existingHashes.add(t.tradeHash);
      added++;
    }
  }
  userDoc.brokerTrades = existing.slice(-500);
  await userDoc.save();

  // Retroactively match and verify any existing LIVE sessions for this trader (strictly 1-to-1 per tradeHash)
  let verifiedSessions = 0;
  const claimedHashes = await getClaimedTradeHashes(userDoc._id);
  const liveSessions = await Journal.find({ userId: userDoc._id, sessionType: 'LIVE' }).sort({ createdAt: 1 });
  for (const s of liveSessions) {
    if (s.brokerVerification && s.brokerVerification.status === 'VERIFIED' && s.brokerVerification.tradeHash) {
      claimedHashes.add(s.brokerVerification.tradeHash);
      continue;
    }
    const m = brokerVerify.matchSessionWithBrokerHistory(s, userDoc.brokerTrades, userDoc.brokerConnection, claimedHashes);
    if (m.verified && (!s.brokerVerification || s.brokerVerification.status !== 'VERIFIED')) {
      s.brokerVerification = {
        status: 'VERIFIED',
        tradeHash: m.matchedTrade.tradeHash,
        matchedInstrument: m.matchedTrade.instrument,
        matchedDirection: m.matchedTrade.direction,
        entryPrice: m.matchedTrade.entryPrice,
        exitPrice: m.matchedTrade.exitPrice,
        openTime: m.matchedTrade.openTime,
        closeTime: m.matchedTrade.closeTime,
        verifiedAt: new Date()
      };
      if (m.matchedTrade.tradeHash) claimedHashes.add(m.matchedTrade.tradeHash);
      verifiedSessions++;
      await s.save().catch(() => {});
    }
  }

  return res.redirect(buildRedirect(added || parsed.length || verifiedSessions, hasInvestorLink));
}

// ── CHART SCREENSHOT ("THE CHART — AS RECORDED") ─────────────────
// Owner-only: loadOwned enforces session ownership; bytes never touch
// the public static dir. Supports single or indexed multi-image access.
async function getChartImage(req, res) {
  const session = await loadOwned(req, res);
  if (!session) {
    return res.status(404).send('No chart recorded');
  }
  const idx = req.params.index !== undefined ? parseInt(req.params.index, 10) : 0;
  if (Array.isArray(session.chartImages) && session.chartImages.length > 0 && Number.isInteger(idx) && idx >= 0 && idx < session.chartImages.length) {
    const imgItem = session.chartImages[idx];
    if (imgItem && imgItem.data) {
      res.set('Content-Type', imgItem.contentType || 'image/png');
      res.set('Cache-Control', 'private, max-age=86400');
      return res.send(imgItem.data);
    }
  }
  if (!session.chartImage || !session.chartImage.data) {
    return res.status(404).send('No chart recorded');
  }
  res.set('Content-Type', session.chartImage.contentType || 'image/png');
  res.set('Cache-Control', 'private, max-age=86400');
  res.send(session.chartImage.data);
}

module.exports = {
  upload,
  getSessions, getPlan, postPlan, getRecord, postRecord,
  getReflect, postReflect, getDetail, getChartImage, postImportBroker
};
