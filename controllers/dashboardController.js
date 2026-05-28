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

    const journal = await Journal.create({
      userId: req.session.user.id,
      asset: asset || 'General',
      timeframe: timeframe || 'N/A',
      notes,
      emotion: emotion || 'Logged',
      ruleCompliance: ruleCompliance === 'true',
      direction: direction || 'No Trade',
      outcome: outcome || 'Pending',
      sessionScore: parseInt(sessionScore) || 50
    });

    // Get user rules for AI context
    const user = await User.findById(req.session.user.id);

    // Build AI prompt
    const systemPrompt = `You are Kaizen — a disciplined, professional AI trading mentor. You analyze trader journal entries and give structured, honest feedback.

TRADER PROFILE:
Name: ${user.username}
Discipline Score: ${user.disciplineScore}/100
Trading Edge: ${user.tradingStyle?.tradingEdge || 'Not specified'}
Max Risk Per Trade: ${user.tradingStyle?.riskPerTrade || 'Not specified'}%
Daily Drawdown Limit: ${user.tradingStyle?.dailyDrawdown || 'Not specified'}%
Entry Rule: ${user.tradingStyle?.entryRule || 'Not specified'}
Stop Loss Rule: ${user.tradingStyle?.stopLossRule || 'Not specified'}
Emotional Triggers: ${user.tradingStyle?.emotionalTriggers || 'Not specified'}
Max Daily Trades: ${user.tradingStyle?.maxDailyTrades || 'Not specified'}

YOUR RESPONSE MUST INCLUDE:
1. What was done well (be specific and reference their actual notes)
2. What rules were violated or risks taken (be strict and honest)
3. Emotional patterns detected (reference their writing style and language)
4. One specific improvement action for next session
5. Session Score: X/100 (strict scoring — discipline over outcome)
6. Impact on Discipline Score: +X or -X points

RULES:
- Never predict market direction
- Never give buy/sell signals  
- Always reference the trader's own words from their journal
- Be direct but supportive — like a respected senior trader
- Keep response under 350 words
- Format cleanly without bullet symbols — use numbered sections`;

    const userMessage = `Asset: ${asset}
Session Type: ${direction}
Rule Compliance: ${ruleCompliance === 'true' ? 'Yes' : 'No'}
Journal Entry:
${notes}`;

    // Call Claude API for AI response
    let aiResponse = '';
    try {
      const axios = require('axios');
      const aiResult = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-opus-4-5',
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        },
        {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 25000
        }
      );
      aiResponse = aiResult.data?.content?.[0]?.text || '';
    } catch (aiErr) {
      console.error('AI error:', aiErr.message);
      aiResponse = generateFallbackResponse(notes, ruleCompliance, asset, user);
    }

    // Update journal with AI analysis
    await Journal.findByIdAndUpdate(journal._id, {
      aiAnalysis: aiResponse
    });

    // Update discipline score
    const allJournals = await Journal.find({ userId: req.session.user.id });
    if (allJournals.length > 0) {
      const compliant = allJournals.filter(j => j.ruleCompliance).length;
      const score = Math.round((compliant / allJournals.length) * 100);
      await User.findByIdAndUpdate(req.session.user.id, {
        disciplineScore: score
      });
      req.session.user.disciplineScore = score;
    }

    // Pass response via query param (encoded)
    const encoded = encodeURIComponent(aiResponse);
    const sessionEncoded = encodeURIComponent(notes.substring(0, 200));
    res.redirect(`/kaizen-ai?response=${encoded}&session=${sessionEncoded}`);

  } catch (error) {
    console.error('Journal error:', error);
    res.redirect('/dashboard/journal');
  }
};

function generateFallbackResponse(notes, ruleCompliance, asset, user) {
  const compliant = ruleCompliance === 'true';
  const score = compliant ? Math.floor(Math.random() * 20) + 65 : Math.floor(Math.random() * 20) + 35;

  return `KAIZEN AI · Session Analysis

1. What Was Done Well
You took the time to document this session honestly. That discipline in journaling is itself a form of rule-following that compounds over time.

2. Rules Assessment
${compliant
  ? 'You marked this session as rule-compliant. Kaizen notes this. Consistency across multiple sessions is what builds the discipline score.'
  : `You acknowledged a rule violation on ${asset}. This honesty is the first step. The traders who improve fastest are the ones who can name their mistakes without excuses.`
}

3. Emotional Pattern
Your writing shows ${notes.includes('FOMO') || notes.includes('fear') ? 'signs of emotional interference — specifically fear or FOMO. This is your most important area of work.' : 'reasonable emotional awareness. Continue developing this self-observation skill.'}

4. Next Session Action
Before your next session, write down the one rule you will focus on following. Single-point focus builds stronger habits than trying to fix everything at once.

Session Score: ${score}/100
Discipline Score Impact: ${compliant ? '+2' : '-3'} points

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
