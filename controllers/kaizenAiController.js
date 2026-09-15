/**
 * KAIZEN AI controller — the trading-side conversation (spec §3.2).
 *
 * Same chat infrastructure as Psychology, different lane: the trades.
 * Threads (kind 'trading'), chart attach, rules quiz, legacy
 * session-analysis display kept for the old journal flow.
 */
const PsychThread = require('../models/PsychThread');

async function loadContext(userId) {
  const User = require('../models/User');
  const Journal = require('../models/Journal');
  const TradingSystem = require('../models/TradingSystem');
  const user = await User.findById(userId);
  if (!user) return null;
  const [sessions, system] = await Promise.all([
    Journal.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    TradingSystem.ensureForUser(user)
  ]);
  return { user, sessions, system };
}

// Context-aware openers from the trader's real situation.
function openersFor(sessions, system) {
  const list = [];
  const last = sessions && sessions[0];
  if (last && last.quickChecks &&
      Object.values(last.quickChecks).includes('NO')) {
    list.push('Want to review today\'s entry against your rules?');
  }
  if (system && system.version > 1) {
    list.push('Your rules changed recently — want to pressure-test the new version?');
  }
  if (system && system.setups && system.setups.length) {
    list.push(`Quiz me on my rules`);
  } else {
    list.push('Help me write my first entry rule');
  }
  list.push('Review a setup I\'m watching');
  return list.slice(0, 3);
}

// ── GET /kaizen-ai — thread list (+ legacy analysis, if redirected here) ──
async function getIndex(req, res) {
  try {
    const userId = req.session.user.id;
    const threads = await PsychThread.find({ userId, kind: 'trading' })
      .sort({ lastMessageAt: -1 }).limit(30).lean();
    const ctx = await loadContext(userId);
    res.render('kaizen-ai', {
      user: req.session.user,
      mode: 'index',
      threads,
      openers: ctx ? openersFor(ctx.sessions, ctx.system) : [],
      aiResponse: req.session.aiResponse || null,
      title: 'KAIZEN AI'
    });
    if (req.session.aiResponse) {
      delete req.session.aiResponse;
      req.session.save(() => {});
    }
  } catch (err) {
    console.error('KAIZEN AI index error:', err.message);
    res.render('kaizen-ai', {
      user: req.session.user, mode: 'index', threads: [],
      openers: [], aiResponse: null, title: 'KAIZEN AI'
    });
  }
}

// ── GET /kaizen-ai/t/:id — one conversation ──
async function getThread(req, res) {
  try {
    const thread = await PsychThread.findOne({
      _id: req.params.id, userId: req.session.user.id, kind: 'trading'
    }).lean();
    if (!thread) return res.redirect('/kaizen-ai');
    res.render('kaizen-ai', {
      user: req.session.user,
      mode: 'thread',
      thread,
      openers: thread.messages && thread.messages.length ? [] : ['Review a setup I\'m watching', 'Quiz me on my rules'],
      aiResponse: null,
      title: thread.title
    });
  } catch (err) {
    console.error('KAIZEN AI thread error:', err.message);
    res.redirect('/kaizen-ai');
  }
}

// ── POST /kaizen-ai/ask — one exchange (message + optional chart image) ──
async function postAsk(req, res) {
  try {
    const userId = req.session.user.id;
    const message = String(req.body.message || '').trim().slice(0, 4000);
    const imageDataUrl = String(req.body.image || '').slice(0, 3_000_000) || null; // ~2MB base64 cap
    const mode = req.body.mode === 'quiz' ? 'quiz' : null;

    if (!message && !imageDataUrl) {
      return res.status(400).json({ error: 'Say something or attach a chart.' });
    }

    let thread = null;
    if (req.body.threadId) {
      thread = await PsychThread.findOne({ _id: req.body.threadId, userId, kind: 'trading' });
      if (!thread) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      const title = mode === 'quiz'
        ? 'Rules quiz'
        : (message.split(/\s+/).slice(0, 7).join(' ').slice(0, 60) || 'Chart review');
      thread = await PsychThread.create({
        userId, kind: 'trading', title, messages: [], messageCount: 0
      });
    }

    thread.messages.push({
      role: 'user', text: message || '(chart attached)',
      hasImage: !!imageDataUrl, createdAt: new Date()
    });

    const ctx = await loadContext(userId);
    if (!ctx) return res.status(401).json({ error: 'Not logged in.' });

    const tradeCoach = require('../services/tradeCoach');
    const { reply } = await tradeCoach.converse({
      user: ctx.user, system: ctx.system, sessions: ctx.sessions,
      threadMessages: thread.messages.slice(0, -1),
      userMessage: mode === 'quiz' ? 'Quiz me on my rules.' : message,
      imageDataUrl, mode
    });

    thread.messages.push({ role: 'kaizen', text: reply, createdAt: new Date() });
    thread.messageCount = thread.messages.length;
    thread.lastMessageAt = new Date();
    await thread.save();

    // Archive write-through so Memories stays the complete record.
    try {
      const Memory = require('../models/Memory');
      await Memory.create({
        userId, type: 'trading',
        sessionData: (message || '(chart attached)').substring(0, 300),
        response: reply, asset: 'KAIZEN AI', sessionScore: 0
      });
    } catch (memErr) {
      console.error('KAIZEN AI archive error:', memErr.message);
    }

    res.json({
      reply,
      threadId: thread._id,
      title: thread.title,
      messageCount: thread.messageCount
    });
  } catch (err) {
    console.error('KAIZEN AI ask error:', err.message);
    res.status(500).json({ error: 'KAIZEN could not respond. Try again in a moment.' });
  }
}

module.exports = { getIndex, getThread, postAsk };
