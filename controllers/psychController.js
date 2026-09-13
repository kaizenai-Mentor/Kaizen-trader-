/**
 * Psychology controller — the conversation surface (spec §3.1, owner vision).
 *
 * ChatGPT-like threads, state-aware openers, self-maintaining MindState
 * (D2: permanent, nothing deletable — no delete routes exist here).
 */
const PsychThread = require('../models/PsychThread');
const MindState = require('../models/MindState');

async function loadContext(userId) {
  const User = require('../models/User');
  const Journal = require('../models/Journal');
  const TradingSystem = require('../models/TradingSystem');
  const [user, sessions, system, mindState] = await Promise.all([
    User.findById(userId),
    Journal.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    (async () => {
      const u = await User.findById(userId);
      return u ? TradingSystem.ensureForUser(u) : null;
    })(),
    MindState.ensureForUser(userId)
  ]);
  return { user, sessions, system, mindState };
}

// State-aware openers: drawn from the trader's real situation, never random.
function openersFor(sessions, mindState) {
  const last5 = (sessions || []).slice(0, 5);
  const violations = last5.filter(s => !s.ruleCompliance).length;
  const activeTheme = mindState && mindState.themes &&
    mindState.themes.find(t => t.status === 'active');

  const list = [];
  if (last5.length >= 3 && violations >= 3) {
    list.push('Something has been off lately. Want to talk about what is driving the rule breaks?');
  } else if (last5.length >= 5 && violations === 0) {
    list.push('You are protecting a good run. What is keeping you steady right now?');
  } else if (last5.length && last5[0].outcome === 'Loss') {
    list.push('That last session hurt. How are you sitting with it today?');
  } else {
    list.push('How is your head at today?');
    list.push('What is on your mind about your trading?');
  }
  if (activeTheme) list.push(`We have talked about ${activeTheme.name.toLowerCase()} before — how is that sitting this week?`);
  return list.slice(0, 3);
}

// One-time migration: V1 Memory psychology docs → an "Early conversations" thread.
async function seedFromMemories(userId) {
  try {
    const Memory = require('../models/Memory');
    const existing = await PsychThread.countDocuments({ userId });
    if (existing > 0) return;
    const docs = await Memory.find({
      userId,
      $or: [{ type: 'psychology' }, { asset: 'Psychology Session' }]
    }).sort({ createdAt: 1 }).limit(200);
    if (!docs.length) return;
    const messages = [];
    for (const d of docs) {
      if (d.sessionData) messages.push({ role: 'user', text: d.sessionData, createdAt: d.createdAt });
      if (d.response) messages.push({ role: 'kaizen', text: d.response, createdAt: d.createdAt });
    }
    if (!messages.length) return;
    await PsychThread.create({
      userId,
      title: 'Early conversations',
      imported: true,
      messages,
      messageCount: messages.length,
      lastMessageAt: messages[messages.length - 1].createdAt
    });
  } catch (err) {
    console.error('Psych migration error:', err.message);
  }
}

// ── GET /psychology — thread list + mind state + start a conversation ──
async function getIndex(req, res) {
  try {
    const userId = req.session.user.id;
    await seedFromMemories(userId);
    const [threads, mindState] = await Promise.all([
      PsychThread.find({ userId }).sort({ lastMessageAt: -1 }).limit(30).lean(),
      MindState.ensureForUser(userId)
    ]);
    const { sessions } = await loadContext(userId);
    res.render('psychology', {
      user: req.session.user,
      mode: 'index',
      threads, mindState,
      openers: openersFor(sessions, mindState),
      title: 'Psychology'
    });
  } catch (err) {
    console.error('Psychology index error:', err.message);
    res.render('psychology', {
      user: req.session.user, mode: 'index',
      threads: [], mindState: null, openers: [], title: 'Psychology'
    });
  }
}

// ── GET /psychology/t/:id — one conversation ──
async function getThread(req, res) {
  try {
    const thread = await PsychThread.findOne({
      _id: req.params.id, userId: req.session.user.id
    }).lean();
    if (!thread) return res.redirect('/psychology');
    const mindState = await MindState.ensureForUser(req.session.user.id);
    const { sessions } = await loadContext(req.session.user.id);
    res.render('psychology', {
      user: req.session.user,
      mode: 'thread',
      thread, mindState,
      openers: thread.messages && thread.messages.length ? [] : openersFor(sessions, mindState),
      title: thread.title
    });
  } catch (err) {
    console.error('Psychology thread error:', err.message);
    res.redirect('/psychology');
  }
}

// ── POST /psychology/ask — one exchange ──
async function postAsk(req, res) {
  try {
    const userId = req.session.user.id;
    const message = String(req.body.message || '').trim().slice(0, 4000);
    if (!message) return res.status(400).json({ error: 'Say something first.' });

    // Find or create the thread
    let thread = null;
    if (req.body.threadId) {
      thread = await PsychThread.findOne({ _id: req.body.threadId, userId });
      if (!thread) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      thread = await PsychThread.create({
        userId,
        title: message.split(/\s+/).slice(0, 7).join(' ').slice(0, 60) || 'Conversation',
        messages: [], messageCount: 0
      });
    }

    thread.messages.push({ role: 'user', text: message, createdAt: new Date() });

    const { user, sessions, system, mindState } = await loadContext(userId);
    const psychCoach = require('../services/psychCoach');
    const { reply, psychState } = await psychCoach.converse({
      user, system, sessions, mindState,
      threadMessages: thread.messages.slice(0, -1),
      userMessage: message
    });

    thread.messages.push({ role: 'kaizen', text: reply, createdAt: new Date() });
    thread.messageCount = thread.messages.length;
    thread.lastMessageAt = new Date();
    await thread.save();

    // Self-maintaining memory (D2) — KAIZEN updates its own understanding.
    if (psychState) {
      psychCoach.applyPsychState(mindState, psychState);
      await mindState.save();
    }

    res.json({
      reply,
      threadId: thread._id,
      title: thread.title,
      messageCount: thread.messageCount
    });
  } catch (err) {
    console.error('Psychology ask error:', err.message);
    res.status(500).json({ error: 'KAIZEN could not respond. Try again in a moment.' });
  }
}

module.exports = { getIndex, getThread, postAsk };
