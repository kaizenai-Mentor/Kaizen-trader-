const User = require('../models/User');
const Journal = require('../models/Journal');

// GET /dashboard
const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const journals = await Journal.find({ userId: req.session.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    const allJournals = await Journal.find({
      userId: req.session.user.id
    });

    let score = 0;
    if (allJournals.length > 0) {
      const compliant = allJournals.filter(j => j.ruleCompliance).length;
      score = Math.round((compliant / allJournals.length) * 100);
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
    console.error('Dashboard error:', error.message);
    res.redirect('/auth/login');
  }
};

// POST /dashboard/journal
const addJournal = async (req, res) => {
  console.log('=== JOURNAL SUBMISSION START ===');
  console.log('Body:', req.body);

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
      console.log('No notes provided');
      return res.redirect('/dashboard/journal');
    }

    console.log('Creating journal entry...');

    // Create journal entry
    const journal = await Journal.create({
      userId: req.session.user.id,
      asset: asset || 'General',
      timeframe: timeframe || 'N/A',
      notes: notes.trim(),
      emotion: emotion || 'Logged',
      ruleCompliance: ruleCompliance === 'true',
      direction: direction || 'Live Trade',
      outcome: outcome || 'Pending',
      sessionScore: parseInt(sessionScore) || 50
    });

    console.log('Journal created:', journal._id);

    // Update discipline score
    const allJournals = await Journal.find({
      userId: req.session.user.id
    });

    const compliant = allJournals.filter(j => j.ruleCompliance).length;
    const score = Math.round((compliant / allJournals.length) * 100);

    await User.findByIdAndUpdate(req.session.user.id, {
      disciplineScore: score
    });
    req.session.user.disciplineScore = score;

    console.log('Score updated:', score);

    // Generate AI response
    const user = await User.findById(req.session.user.id);
    const compliantText = ruleCompliance === 'true' ? 'Yes' : 'No';
    let aiResponse = buildFallbackResponse(
      notes, ruleCompliance === 'true', asset || 'General', user
    );

    console.log('Trying Anthropic API...');

    // Try Anthropic if key exists
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const https = require('https');

        const payload = JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 500,
          system: `You are Kaizen, a strict AI trading discipline mentor. 
Analyze this journal entry and respond in exactly this format with no extra text:

WHAT YOU DID WELL
[2 sentences specific to their entry]

WHAT NEEDS IMPROVEMENT  
[2 honest sentences]

EMOTIONAL PATTERN
[1 sentence about emotions detected in their writing]

NEXT SESSION ACTION
[1 specific action]

SESSION SCORE: [number]/100
DISCIPLINE IMPACT: [+number or -number] points`,
          messages: [{
            role: 'user',
            content: `Trader: ${user.username}
Asset: ${asset || 'Not specified'}
Session Type: ${direction || 'Live Trade'}
Followed Rules: ${compliantText}
Journal: ${notes}`
          }]
        });

        const response = await new Promise((resolve, reject) => {
          const req2 = https.request({
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload)
            }
          }, (res2) => {
            let data = '';
            res2.on('data', chunk => data += chunk);
            res2.on('end', () => resolve(data));
          });

          req2.on('error', reject);
          req2.setTimeout(15000, () => {
            req2.destroy();
            reject(new Error('Timeout'));
          });

          req2.write(payload);
          req2.end();
        });

        const parsed = JSON.parse(response);
        if (parsed.content && parsed.content[0] && parsed.content[0].text) {
          aiResponse = parsed.content[0].text;
          console.log('Anthropic response received');
        }

      } catch (aiErr) {
        console.error('Anthropic failed:', aiErr.message);
        // Keep fallback response
      }
    } else {
      console.log('No Anthropic key — using fallback');
    }

    // Update journal with AI analysis
    await Journal.findByIdAndUpdate(journal._id, {
      aiAnalysis: aiResponse
    });

    // Save to Memory collection
    try {
      const Memory = require('../models/Memory');
      await Memory.create({
        userId: req.session.user.id,
        sessionData: notes.substring(0, 500),
        response: aiResponse,
        asset: asset || 'General',
        sessionScore: parseInt(sessionScore) || 50
      });
      console.log('Memory saved');
    } catch (memErr) {
      console.error('Memory save failed:', memErr.message);
      // Non-critical — continue
    }

    // Store response in session
    req.session.aiResponse = aiResponse;
    console.log('Session aiResponse set, length:', aiResponse.length);

    // Save session then redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err.message);
      }
      console.log('Redirecting to /kaizen-ai');
      res.redirect('/kaizen-ai');
    });

  } catch (error) {
    console.error('=== JOURNAL ERROR ===', error.message);
    console.error(error.stack);
    res.redirect('/dashboard/journal?error=true');
  }
};

function buildFallbackResponse(notes, compliant, asset, user) {
  const score = compliant
    ? Math.floor(Math.random() * 15) + 68
    : Math.floor(Math.random() * 15) + 32;

  const hasFOMO = /fomo|fear of missing/i.test(notes);
  const hasRevenge = /revenge|frustrat|angry|anger/i.test(notes);
  const hasWin = /tp|take profit|profit|win|winner/i.test(notes);
  const hasLoss = /sl|stop loss|loss|losing/i.test(notes);

  const wellDone = compliant
    ? `You followed your rules during this ${asset} session. This is the foundation that separates profitable traders from everyone else. One compliant session builds the habit.`
    : `You took time to journal this session honestly. Self-reporting a rule violation takes character. Most traders pretend it did not happen.`;

  const improve = !compliant
    ? `A rule was broken this session. Before trading again, identify the exact moment the rule broke and what triggered it. Vague awareness does not prevent repetition.`
    : `Consistency is your focus now. A single compliant session means nothing without the next one. Log every session without exception.`;

  const emotion = hasFOMO
    ? `FOMO is present in your writing. This is your documented emotional trigger. The next time you feel it, pause for 60 seconds before acting.`
    : hasRevenge
    ? `Signs of frustration are in your language. Trading after emotional upset is your highest-risk behavior. Close the platform when this feeling appears.`
    : hasLoss
    ? `You experienced a loss this session. Your emotional response to losses is one of the most important patterns Kaizen tracks over time.`
    : hasWin
    ? `A winning session. Watch for overconfidence in the next session — it is the most common cause of discipline breakdown after wins.`
    : `Your emotional state appears relatively neutral in this entry. This is the ideal state for disciplined trading.`;

  const action = hasFOMO
    ? `Next session: write down every time you feel FOMO but do NOT act on it. Count them. Awareness precedes control.`
    : !compliant
    ? `Next session: write your most broken rule on paper before you open any chart. Put it where you can see it.`
    : `Next session: log your analysis before entering any trade. The act of writing forces clarity.`;

  const impact = compliant
    ? `+${Math.max(1, Math.floor(score / 25))}`
    : `-${Math.max(1, Math.floor((100 - score) / 20))}`;

  return `WHAT YOU DID WELL
${wellDone}

WHAT NEEDS IMPROVEMENT
${improve}

EMOTIONAL PATTERN
${emotion}

NEXT SESSION ACTION
${action}

SESSION SCORE: ${score}/100
DISCIPLINE IMPACT: ${impact} points`;
}

// GET /dashboard/journal
const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });

    const user = await User.findById(req.session.user.id);

    if (!user) return res.redirect('/auth/login');

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
