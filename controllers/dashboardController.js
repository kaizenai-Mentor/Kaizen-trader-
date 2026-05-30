const User = require('../models/User');
const Journal = require('../models/Journal');

// GET /dashboard
const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const journals = await Journal.find({ userId: req.session.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    const allJournals = await Journal.find({ userId: req.session.user.id });
    let score = 0;

    if (allJournals.length > 0) {
      const compliantSessions = allJournals.filter(j => j.ruleCompliance).length;
      score = Math.round((compliantSessions / allJournals.length) * 100);

      await User.findByIdAndUpdate(req.session.user.id, {
        disciplineScore: score
      });

      req.session.user.disciplineScore = score;
    }

    res.render('dashboard', {
      user,
      journals,
      disciplineScore: score,
      totalSessions: allJournals.length
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/auth/login');
  }
};

// POST /dashboard/journal
const addJournal = async (req, res) => {
  try {
    const {
      asset,
      timeframe,
      notes,
      emotion,
      ruleCompliance,
      direction,
      outcome,
      sessionScore
    } = req.body;

    if (!notes || notes.trim() === '') {
      return res.redirect('/dashboard/journal');
    }

    const journal = await Journal.create({
      userId: req.session.user.id,
      asset: asset || 'General',
      timeframe: timeframe || 'N/A',
      notes,
      emotion: emotion || 'Logged',
      ruleCompliance: ruleCompliance === 'true',
      direction: direction || 'Live Trade',
      outcome: outcome || 'Pending',
      sessionScore: parseInt(sessionScore) || 50
    });

    const user = await User.findById(req.session.user.id);

    // Update discipline score
    const allJournals = await Journal.find({
      userId: req.session.user.id
    });

    if (allJournals.length > 0) {
      const compliant = allJournals.filter(j => j.ruleCompliance).length;
      const score = Math.round((compliant / allJournals.length) * 100);
      await User.findByIdAndUpdate(req.session.user.id, {
        disciplineScore: score
      });
      req.session.user.disciplineScore = score;
    }

    // Generate AI response
    let aiResponse = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const axios = require('axios');
        const result = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-haiku-4-5',
            max_tokens: 500,
            system: `You are Kaizen, a disciplined AI trading mentor. Analyze this trader's journal entry and give structured feedback.

Trader: ${user.username}
Discipline Score: ${user.disciplineScore}/100
Strategy: ${user.tradingStyle?.tradingEdge || 'Not set'}
Max Risk: ${user.tradingStyle?.riskPerTrade || '1'}% per trade
Daily Limit: ${user.tradingStyle?.dailyDrawdown || '3'}%
Emotional Triggers: ${user.tradingStyle?.emotionalTriggers || 'Not set'}

Respond with exactly this format:

WHAT YOU DID WELL
[2-3 sentences]

WHAT NEEDS IMPROVEMENT
[2-3 sentences, be honest and direct]

EMOTIONAL PATTERN DETECTED
[1-2 sentences about their emotional state from their writing]

ACTION FOR NEXT SESSION
[1 specific action]

SESSION SCORE: [X]/100
DISCIPLINE IMPACT: [+X or -X] points`,
            messages: [{
              role: 'user',
              content: `Asset: ${asset || 'Not specified'}
Session Type: ${direction || 'Live Trade'}
Rule Compliance: ${ruleCompliance === 'true' ? 'Yes' : 'No'}

Journal Entry:
${notes}`
            }]
          },
          {
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            timeout: 20000
          }
        );
        aiResponse = result.data?.content?.[0]?.text || '';
      } catch (aiErr) {
        console.error('Anthropic API error:', aiErr.message);
        aiResponse = buildFallback(notes, ruleCompliance === 'true', asset, user.username);
      }
    } else {
      aiResponse = buildFallback(notes, ruleCompliance === 'true', asset, user.username);
    }

    // Save to journal
    await Journal.findByIdAndUpdate(journal._id, {
      aiAnalysis: aiResponse
    });

    // Save to memories
    const Memory = require('../models/Memory');
    await Memory.create({
      userId: req.session.user.id,
      sessionData: notes.substring(0, 500),
      response: aiResponse,
      asset: asset || 'General',
      sessionScore: parseInt(sessionScore) || 50
    });

    // Store AI response in session for retrieval
    req.session.aiResponse = aiResponse;
    req.session.save(function(err) {
      res.redirect('/kaizen-ai');
    });

  } catch (error) {
    console.error('Journal submission error:', error.message);
    res.redirect('/dashboard/journal?error=true');
  }
};

function buildFallback(notes, compliant, asset, username) {
  const score = compliant
    ? Math.floor(Math.random() * 15) + 70
    : Math.floor(Math.random() * 15) + 35;

  const hasFOMO = notes.toLowerCase().includes('fomo');
  const hasLoss = notes.toLowerCase().includes('sl') ||
                  notes.toLowerCase().includes('loss') ||
                  notes.toLowerCase().includes('stop');
  const hasWin = notes.toLowerCase().includes('tp') ||
                 notes.toLowerCase().includes('profit') ||
                 notes.toLowerCase().includes('win');

  return `WHAT YOU DID WELL
${compliant
  ? `You followed your rules this session on ${asset || 'this asset'}. That is the foundation of everything. Consistent rule-following compounds into profitability over time.`
  : `You took the time to journal this session honestly. Self-awareness is the beginning of discipline. The fact that you acknowledged what happened shows you are building the right habits.`
}

WHAT NEEDS IMPROVEMENT
${!compliant
  ? `You marked this session as non-compliant. Identify the exact rule that was broken and write it down before your next session. Vague awareness does not create change — specific identification does.`
  : `Continue logging sessions with this level of detail. The more specific your notes, the more patterns Kaizen can identify over time.`
}
${hasLoss ? `Stop loss hits are part of the process. What matters is whether the entry followed your rules. If it did, the loss is irrelevant to your discipline score.` : ''}
${hasFOMO ? `FOMO was present in this session. This is your identified emotional trigger. The next time you feel it, write it down immediately before acting on it.` : ''}

EMOTIONAL PATTERN DETECTED
${hasFOMO
  ? 'FOMO detected in your writing. This is a pattern Kaizen will monitor. Your onboarding profile flagged this as a known trigger — be especially cautious after missing moves.'
  : hasLoss
  ? 'Post-loss emotional state is detectable in your language. Avoid making decisions immediately after a stop loss is hit.'
  : 'Your writing suggests a relatively neutral emotional state this session. This is ideal for disciplined trading.'}

ACTION FOR NEXT SESSION
Before opening any chart, write down the one rule you will prioritize following. Place it where you can see it. Review it after the session.

SESSION SCORE: ${score}/100
DISCIPLINE IMPACT: ${compliant ? '+' + Math.floor(score / 20) : '-' + Math.floor((100 - score) / 15)} points
改善 — Small improvement. Every session.`;
}

// GET /dashboard/journal
const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({ 
      userId: req.session.user.id 
    }).sort({ createdAt: -1 });

    const user = await User.findById(req.session.user.id);

    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('journal', { 
      user, 
      journals: journals || []
    });

  } catch (error) {
    console.error('Journals error:', error.message);
    res.status(500).send(`
      <html>
        <body style="background:#080808;color:#F5F3EF;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#C9A84C;">改 Kaizen</h2>
          <p>Journal temporarily unavailable.</p>
          <a href="/dashboard" style="color:#C9A84C;">← Back to Dashboard</a>
        </body>
      </html>
    `);
  }
};

module.exports = {
  getDashboard,
  addJournal,
  getJournals
};
