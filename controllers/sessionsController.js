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

// ── LIST ─────────────────────────────────────────────────────────
async function getSessions(req, res) {
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  const sessions = await Journal.find({ userId: req.session.user.id })
    .sort({ createdAt: -1 }).limit(60).lean();
  const openPlan = sessions.find(s => s.state === 'PLANNED');
  res.render('sessions', {
    user: req.session.user, sessions, openPlan, system,
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

  const session = new Journal({
    userId: req.session.user.id,
    sessionType: type,
    state: 'PLANNED',
    plan: {
      setup: skipped ? '' : (req.body.setup || ''),
      entryCondition: skipped ? '' : (req.body.entryCondition || ''),
      invalidation: skipped ? '' : (req.body.invalidation || ''),
      predefinedRisk: skipped ? '' : (req.body.predefinedRisk || ''),
      emotionalState: skipped ? '' : (req.body.emotionalState || ''),
      confidence: skipped ? null : (parseInt(req.body.confidence, 10) || null),
      skipped,
      systemVersion: system.version,
      createdAt: new Date()
    },
    asset: skipped ? 'General' : (req.body.setup || 'General'),
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

  session.notes = notes;
  session.asset = req.body.asset || session.asset || 'General';
  session.timeframe = req.body.timeframe || 'N/A';
  session.direction = `${session.sessionType} Session`;
  if (req.body.outcome && ['Win', 'Loss', 'Breakeven', 'No Trade'].includes(req.body.outcome)) {
    session.outcome = req.body.outcome;
  }
  if (req.body.rrAchieved) session.rrAchieved = req.body.rrAchieved;
  if (req.body.pipsGained) session.pipsGained = req.body.pipsGained;
  if (req.file) {
    session.hasChartImage = true; // image bytes handled by existing image pipeline when attached
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
  session.quickChecks = q;
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

  // Streak + badges continue on the V1 rules (log-a-day consistency)
  try {
    const userDoc = await User.findById(req.session.user.id);
    const all = await Journal.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
    const compliant = session.quickChecks.followedPlan !== 'NO';
    await checkBadges(userDoc, all.length, compliant);
    await userDoc.save();
    req.session.user = {
      ...req.session.user,
      streak: userDoc.streak, badges: userDoc.badges
    };
  } catch (e) {
    console.error('postRecord badge/streak error:', e.message);
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
  session.state = 'REFLECTED';
  await session.save();

  // ── ANALYZE: two machines, one response ──
  const userDoc = await User.findById(req.session.user.id);
  const system = await TradingSystem.ensureForUser(userDoc);
  const recentSessions = await Journal.find({ userId: req.session.user.id })
    .sort({ createdAt: -1 }).limit(21).lean();

  // Machine 1 — deterministic engine (with one-time V1 extraction)
  let extracted = userDoc.v1Evidence || null;
  if (!userDoc.v1ExtractedAt) {
    extracted = await runV1Extraction(userDoc, Journal) || null;
    if (extracted) {
      userDoc.v1Evidence = extracted;
      await userDoc.save();
    }
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

  // Machine 2 — the coach (改): explains, never scores
  let coaching = '';
  try {
    coaching = await aiCoach.analyzeSession({
      session: session.toObject(), user: userDoc, system,
      recentSessions: recentSessions.filter(s => String(s._id) !== String(session._id))
    });
    const ex = aiCoach.parseExtracted(coaching);
    if (ex) {
      if (['Win', 'Loss', 'Breakeven', 'No Trade'].includes(ex.outcome) && session.outcome === 'Pending') {
        session.outcome = ex.outcome;
      }
      if (ex.rr && ex.rr !== 'N/A' && !session.rrAchieved) session.rrAchieved = ex.rr;
      if (ex.pips && ex.pips !== 'N/A' && !session.pipsGained) session.pipsGained = ex.pips;
      coaching = aiCoach.stripExtracted(coaching);
    }
  } catch (e) {
    console.error('AI coach error:', e.message);
    coaching = aiCoach.buildFallback(session);
  }

  session.aiAnalysis = coaching;
  session.state = 'ANALYZED';
  await session.save();

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
  const latest = await ScoreSnapshot.findOne({ userId: req.session.user.id })
    .sort({ computedAt: -1 }).lean();
  res.render('session-detail', {
    user: req.session.user, session, score: latest,
    dimensionLabels: DIMENSION_LABELS, title: 'Session'
  });
}

module.exports = {
  upload,
  getSessions, getPlan, postPlan, getRecord, postRecord,
  getReflect, postReflect, getDetail
};
