/**
 * KAIZEN AI controller — the ONE reflection conversation (owner
 * directive 20 Oct 2026): trades, emotions and the patterns connecting
 * both live in the same room. Surfaces both thread kinds ('trading' and
 * legacy 'psychology'), keeps the old Psychology threads readable, and
 * captures emotional patterns on every exchange via psychCoach into the
 * MindState — so the coach's next reply connects them to the record.
 */
const PsychThread = require('../models/PsychThread');

async function loadContext(userId) {
  const User = require('../models/User');
  const Journal = require('../models/Journal');
  const TradingSystem = require('../models/TradingSystem');
  const MindState = require('../models/MindState');
  const user = await User.findById(userId);
  if (!user) return null;
  const [sessions, system, mindState] = await Promise.all([
    Journal.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    TradingSystem.ensureForUser(user),
    MindState.ensureForUser(userId)
  ]);
  return { user, sessions, system, mindState };
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
    // One inbox: trading threads AND legacy psychology threads.
    const threads = await PsychThread.find({ userId, kind: { $in: ['trading', 'psychology'] } })
      .sort({ lastMessageAt: -1 }).limit(30).lean();
    const ctx = await loadContext(userId);
    res.render('kaizen-ai', {
      user: req.session.user,
      mode: 'index',
      threads,
      openers: ctx ? openersFor(ctx.sessions, ctx.system) : [],
      themes: (ctx && ctx.mindState && ctx.mindState.themes) || [],
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
      openers: [], themes: [], aiResponse: null, title: 'KAIZEN AI'
    });
  }
}

// ── GET /kaizen-ai/t/:id — one conversation ──
async function getThread(req, res) {
  try {
    const thread = await PsychThread.findOne({
      _id: req.params.id, userId: req.session.user.id,
      kind: { $in: ['trading', 'psychology'] }
    }).lean();
    if (!thread) return res.redirect('/kaizen-ai');
    const ctx = await loadContext(req.session.user.id);
    res.render('kaizen-ai', {
      user: req.session.user,
      mode: 'thread',
      thread,
      openers: thread.messages && thread.messages.length ? [] : ['Review a setup I\'m watching', 'Quiz me on my rules'],
      themes: (ctx && ctx.mindState && ctx.mindState.themes) || [],
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
      thread = await PsychThread.findOne({ _id: req.body.threadId, userId, kind: { $in: ['trading', 'psychology'] } });
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

    // Pattern capture (five layers): every exchange is scanned for the
    // emotional/behavioral layer and written to the MindState, so the
    // coach's next reply — and the Improve recommendations — see it.
    const capturePatterns = async () => {
      try {
        const psychCoach = require('../services/psychCoach');
        const psychState = psychCoach.deterministicState(message);
        if (psychState && Array.isArray(psychState.themes) && psychState.themes.length && ctx.mindState) {
          psychCoach.applyPsychState(ctx.mindState, psychState);
          await ctx.mindState.save();
        }
      } catch (capErr) {
        console.error('Pattern capture error:', capErr.message);
      }
    };

    // ── Streaming path (SSE): the reply arrives as it is written ──
    if (String(req.body.stream) === '1') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no'
      });
      if (res.flushHeaders) res.flushHeaders();
      const send = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
      send({ type: 'meta', threadId: String(thread._id), title: thread.title, newThread: !req.body.threadId });

      let full = '';
      let emitted = false;
      const persist = async (visible) => {
        thread.messages.push({ role: 'kaizen', text: visible, createdAt: new Date() });
        thread.messageCount = thread.messages.length;
        thread.lastMessageAt = new Date();
        await thread.save();
        try {
          const Memory = require('../models/Memory');
          await Memory.create({
            userId, type: 'trading',
            sessionData: (message || '(chart attached)').substring(0, 300),
            response: visible, asset: 'KAIZEN AI', sessionScore: 0
          });
        } catch (memErr) {
          console.error('KAIZEN AI archive error:', memErr.message);
        }
      };
      try {
        for await (const chunk of tradeCoach.streamConverse({
          user: ctx.user, system: ctx.system, sessions: ctx.sessions,
          mindState: ctx.mindState,
          threadMessages: thread.messages.slice(0, -1),
          userMessage: mode === 'quiz' ? 'Quiz me on my rules.' : message,
          imageDataUrl, mode
        })) {
          full += chunk;
          emitted = true;
          send({ type: 'delta', text: chunk });
        }
        await persist(full.trim());
        await capturePatterns();
        send({ type: 'done', threadId: String(thread._id), messageCount: thread.messageCount });
      } catch (err) {
        console.error('KAIZEN AI stream error:', err.message);
        if (emitted) {
          try {
            await persist(full.trim() || '…');
            send({ type: 'done', threadId: String(thread._id), messageCount: thread.messageCount, partial: true });
          } catch (e2) {
            send({ type: 'done', partial: true });
          }
        } else {
          send({ type: 'error', error: 'KAIZEN could not respond. Try again in a moment.' });
        }
      }
      return res.end();
    }

    const { reply } = await tradeCoach.converse({
      user: ctx.user, system: ctx.system, sessions: ctx.sessions,
      mindState: ctx.mindState,
      threadMessages: thread.messages.slice(0, -1),
      userMessage: mode === 'quiz' ? 'Quiz me on my rules.' : message,
      imageDataUrl, mode
    });

    thread.messages.push({ role: 'kaizen', text: reply, createdAt: new Date() });
    thread.messageCount = thread.messages.length;
    thread.lastMessageAt = new Date();
    await thread.save();
    await capturePatterns();

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
