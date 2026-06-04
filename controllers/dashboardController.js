const User = require('../models/User');
const Journal = require('../models/Journal');

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

const addJournal = async (req, res) => {
  console.log('=== JOURNAL SUBMISSION START ===');

  try {
    const { notes, ruleCompliance, direction, timeframe, outcome, sessionScore } = req.body;

    if (!notes || notes.trim() === '') {
      return res.redirect('/dashboard/journal');
    }

    // Extract asset from notes automatically
    const assetPatterns = [
      /\b([A-Z]{3}\/[A-Z]{3})\b/g,
      /\b([A-Z]{6})\b/g,
      /\b(GOLD|SILVER|OIL|BTC|ETH|XAU|XAG)\b/gi
    ];
    let detectedAsset = 'General';
    for (const pattern of assetPatterns) {
      const match = notes.match(pattern);
      if (match && match[0]) {
        detectedAsset = match[0];
        break;
      }
    }
    const asset = req.body.asset || detectedAsset;

    const journal = await Journal.create({
      userId: req.session.user.id,
      asset,
      timeframe: timeframe || 'N/A',
      notes: notes.trim(),
      emotion: 'Logged',
      ruleCompliance: ruleCompliance === 'true',
      direction: direction || 'Live Trade',
      outcome: outcome || 'Pending',
      sessionScore: parseInt(sessionScore) || 50
    });

    console.log('Journal created:', journal._id);

    const user = await User.findById(req.session.user.id);
    const allJournals = await Journal.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });

    const compliantCount = allJournals.filter(j => j.ruleCompliance).length;
    const overallScore = Math.round((compliantCount / allJournals.length) * 100);
    await User.findByIdAndUpdate(req.session.user.id, {
      disciplineScore: overallScore
    });
    req.session.user.disciplineScore = overallScore;

    // Update streak
const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const lastSession = allJournals[1]; // second most recent (first is current)

if (ruleCompliance === 'true') {
  if (lastSession) {
    const lastDate = new Date(lastSession.createdAt);
    lastDate.setHours(0, 0, 0, 0);
    const isYesterday = lastDate.getTime() === yesterday.getTime();
    const isToday = lastDate.getTime() === today.getTime();

    if (isYesterday) {
      // Consecutive day — increment streak
      await User.findByIdAndUpdate(req.session.user.id, {
        $inc: { streak: 1 }
      });
      req.session.user.streak = (req.session.user.streak || 0) + 1;
    } else if (isToday) {
      // Same day — keep streak
    } else {
      // Gap in days — reset streak to 1
      await User.findByIdAndUpdate(req.session.user.id, { streak: 1 });
      req.session.user.streak = 1;
    }
  } else {
    // First session ever
    await User.findByIdAndUpdate(req.session.user.id, { streak: 1 });
    req.session.user.streak = 1;
  }
} else {
  // Rule violated — reset streak
  await User.findByIdAndUpdate(req.session.user.id, { streak: 0 });
  req.session.user.streak = 0;
  } 

    // After fetching allJournals, add:
let predictiveWarning = null;

if (allJournals.length >= 5) {
  const recentFive = allJournals.slice(0, 5);
  const violations = recentFive.filter(j => !j.ruleCompliance).length;
  const allText = recentFive.map(j => j.notes.toLowerCase()).join(' ');
  const fomoCount = (allText.match(/fomo/gi) || []).length;
  const revengeCount = (allText.match(/revenge|frustrat/gi) || []).length;

  if (violations >= 3) {
    predictiveWarning = {
      type: 'compliance',
      message: `You have violated rules in ${violations} of your last 5 sessions. Before opening any chart today, review your entry criteria.`,
      level: 'high'
    };
  } else if (fomoCount >= 2) {
    predictiveWarning = {
      type: 'fomo',
      message: 'FOMO has appeared in your recent sessions. Stay off the charts until a valid setup forms today.',
      level: 'medium'
    };
  } else if (revengeCount >= 1) {
    predictiveWarning = {
      type: 'revenge',
      message: 'Signs of frustration detected in recent sessions. Trade only if your emotional state is neutral today.',
      level: 'medium'
    };
  } else if (violations === 0 && recentFive.length === 5) {
    predictiveWarning = {
      type: 'positive',
      message: 'Five consecutive compliant sessions. Your discipline is building. Protect this streak today.',
      level: 'positive'
    };
  }
}

// Add to render call:
res.render('dashboard', {
  user,
  journals,
  disciplineScore: score,
  totalSessions: allJournals.length,
  predictiveWarning
});

    // Build session history context
    const totalSessions = allJournals.length;
    const recentSessions = allJournals.slice(0, 10);
    const recentCompliant = recentSessions.filter(j => j.ruleCompliance).length;
    const recentTrend = recentCompliant > recentSessions.length * 0.65
      ? 'improving'
      : recentCompliant < recentSessions.length * 0.4
      ? 'declining'
      : 'inconsistent';

    const allText = allJournals.map(j => j.notes.toLowerCase()).join(' ');
    const fomoCount = (allText.match(/fomo/gi) || []).length;
    const revengeCount = (allText.match(/revenge|frustrat/gi) || []).length;

    const sessionHistory = allJournals.slice(1, 6).map((j, i) => {
      return `Past session ${i + 1}: ${j.asset} | Compliant: ${j.ruleCompliance ? 'Yes' : 'No'} | "${j.notes.substring(0, 150)}"`;
    }).join('\n');

    let aiResponse = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const https = require('https');

        const systemPrompt = `You are Kaizen — an elite AI trading mentor. You are direct, specific, deeply observant, and psychologically sophisticated. You are not a chatbot. You are a senior trader who has seen thousands of journals.

TRADER PROFILE:
Name: ${user.username}
Sessions logged: ${totalSessions}
Overall discipline: ${overallScore}%
Recent trend (last 10): ${recentTrend}
FOMO mentions all-time: ${fomoCount}
Revenge trade mentions: ${revengeCount}
Strategy: ${user.tradingStyle?.tradingEdge || 'Not set'}
Max risk per trade: ${user.tradingStyle?.riskPerTrade || 'Not set'}%
Daily loss limit: ${user.tradingStyle?.dailyDrawdown || 'Not set'}%
Entry rule: ${user.tradingStyle?.entryRule || 'Not set'}
Stop loss rule: ${user.tradingStyle?.stopLossRule || 'Not set'}
Known triggers: ${user.tradingStyle?.emotionalTriggers || 'Not set'}

RECENT SESSION HISTORY:
${sessionHistory || 'First session.'}

RESPONSE RULES — READ CAREFULLY:
1. Reference SPECIFIC details: exact pairs, prices, timeframes, strategy steps the trader mentioned
2. Do NOT always assume emotional causes — sometimes failures are technical (bad entry, wrong timeframe, misread structure). Identify the actual root cause
3. Do NOT use the word "emotional" unless emotion is actually the root cause
4. Do NOT repeat advice from previous sessions — vary your language and insights every single time
5. Do NOT give generic trading advice — only reference what THIS trader wrote
6. Score strictly: 0-100% based on process adherence, not outcome
7. Be concise — maximum 300 words total
8. Format your response with these FLEXIBLE sections — only include sections relevant to this specific entry:

WHAT YOU EXECUTED WELL
[specific to their entry — mention actual details they wrote]

WHERE THE BREAKDOWN OCCURRED  
[identify the real cause — technical, behavioral, psychological, or situational]

PATTERN KAIZEN IS TRACKING
[only mention if a genuine pattern exists across sessions — skip if first session or no clear pattern]

ONE THING TO FOCUS ON
[single specific action for next session — must be different from generic advice]

DISCIPLINE SCORE: [X]%
OVERALL SCORE: ${overallScore}%`;

        const userMessage = `Session type: ${direction || 'Live Trade'}
Followed all rules: ${ruleCompliance === 'true' ? 'Yes' : 'No'}

Full journal entry:
${notes}`;

        const payload = JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
        });

        console.log('Calling Anthropic API...');

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

          req2.on('error', (e) => {
            console.error('HTTPS error:', e.message);
            reject(e);
          });

          req2.setTimeout(20000, () => {
            console.error('Anthropic timeout');
            req2.destroy();
            reject(new Error('Timeout'));
          });

          req2.write(payload);
          req2.end();
        });

        console.log('Raw Anthropic response:', response.substring(0, 200));

        const parsed = JSON.parse(response);
        if (parsed.content?.[0]?.text) {
          aiResponse = parsed.content[0].text;
          console.log('Claude response received, length:', aiResponse.length);
        } else if (parsed.error) {
          console.error('Claude API error:', JSON.stringify(parsed.error));
          aiResponse = buildVariedFallback(notes, ruleCompliance === 'true', asset, user, totalSessions, recentTrend, overallScore);
        }

      } catch (aiErr) {
        console.error('Anthropic call failed:', aiErr.message);
        aiResponse = buildVariedFallback(notes, ruleCompliance === 'true', asset, user, totalSessions, recentTrend, overallScore);
      }
    } else {
      console.log('ANTHROPIC_API_KEY not set — using fallback');
      aiResponse = buildVariedFallback(notes, ruleCompliance === 'true', asset, user, totalSessions, recentTrend, overallScore);
    }

    await Journal.findByIdAndUpdate(journal._id, { aiAnalysis: aiResponse });

    try {
      const Memory = require('../models/Memory');
      await Memory.create({
        userId: req.session.user.id,
        sessionData: notes.substring(0, 500),
        response: aiResponse,
        asset,
        sessionScore: parseInt(sessionScore) || 50
      });
      console.log('Memory saved');
    } catch (memErr) {
      console.error('Memory save failed:', memErr.message);
    }

    req.session.aiResponse = aiResponse;
    req.session.save((err) => {
      if (err) console.error('Session save error:', err.message);
      console.log('Redirecting to /kaizen-ai');
      res.redirect('/kaizen-ai');
    });

  } catch (error) {
    console.error('=== JOURNAL ERROR ===', error.message);
    console.error(error.stack);
    res.redirect('/dashboard/journal?error=true');
  }
};

function buildVariedFallback(notes, compliant, asset, user, totalSessions, trend, overallScore) {
  const sessionScore = compliant
    ? Math.floor(Math.random() * 20) + 65
    : Math.floor(Math.random() * 25) + 25;

  const hasFOMO = /fomo|fear of missing/i.test(notes);
  const hasTA = /entry|structure|timeframe|sweep|mss|liquidity|zone|level|trend|checklist/i.test(notes);
  const hasLoss = /sl|stop loss|loss|losing|blew|blow/i.test(notes);
  const hasWin = /tp|take profit|win|profit|hit/i.test(notes);
  const hasProp = /prop|funded|account/i.test(notes);

  const impact = compliant
    ? `+${Math.max(1, Math.floor(sessionScore / 25))}%`
    : `-${Math.max(2, Math.floor((100 - sessionScore) / 15))}%`;

  const variations = [
    {
      well: compliant
        ? `The checklist discipline on ${asset} is the exact behavior that separates developing traders from consistent ones. You executed the process.`
        : `You documented what happened without excuses. That level of self-honesty is rarer than most traders admit.`,
      breakdown: hasTA && !compliant
        ? `The breakdown was technical — ${hasFOMO ? 'FOMO pushed you into an entry before your setup was complete' : 'the entry criteria were not fully met before execution'}. This is a process gap, not a character flaw. Fix the process.`
        : !compliant
        ? `A rule was bypassed. The specific rule matters more than the outcome — identify which rule broke and under what condition.`
        : `No critical breakdown this session. Focus on replicating this process.`,
      focus: hasLoss && hasProp
        ? `With a prop account under pressure, your next session must start with a written rule: no entry without full checklist completion, regardless of how clear the setup appears.`
        : hasFOMO
        ? `Before the next session, identify the specific moment FOMO appeared. Write the time, the pair, and what price was doing. Specificity turns awareness into prevention.`
        : `Log your next session with the same level of detail as this one. The pattern Kaizen is building about your trading requires consistent data.`
    },
    {
      well: compliant
        ? `Following your process on ${asset} when the market was moving requires more discipline than most traders have. This is bankable behavior.`
        : `Honest documentation after a difficult session is not small. Many traders avoid journaling precisely when it matters most.`,
      breakdown: hasTA && !compliant
        ? `The entry on ${asset} did not meet your defined criteria. That is a technical execution failure — your edge requires specific conditions, and this entry bypassed at least one of them.`
        : !compliant
        ? `Something overrode your rules. Whether it was speed, conviction, or external noise — identify the exact override mechanism. That is where your work is.`
        : `The session held together. What you want now is to understand why — so you can replicate it.`,
      focus: totalSessions < 5
        ? `You are still in the early data-building phase. Kaizen needs at least 10 sessions to begin showing reliable patterns. Keep logging with this level of honesty.`
        : trend === 'declining'
        ? `Your recent sessions are trending toward lower compliance. Before the next session, review your last three entries and identify the common thread.`
        : `Your compliance is building. The next test is whether you hold this standard when a trade is moving against you mid-position.`
    }
  ];

  const v = variations[Math.floor(Math.random() * variations.length)];

  return `WHAT YOU EXECUTED WELL
${v.well}

WHERE THE BREAKDOWN OCCURRED
${v.breakdown}

ONE THING TO FOCUS ON
${v.focus}

DISCIPLINE SCORE: ${sessionScore}%
OVERALL SCORE: ${overallScore}%`;
}

// Extract score from AI response
let extractedScore = parseInt(sessionScore) || 50;
const scoreMatch = aiResponse.match(/DISCIPLINE SCORE:\s*(\d+)%/i);
if (scoreMatch && scoreMatch[1]) {
  extractedScore = parseInt(scoreMatch[1]);
}

// Update journal with AI analysis AND extracted score
await Journal.findByIdAndUpdate(journal._id, {
  aiAnalysis: aiResponse,
  sessionScore: extractedScore
});

const getJournals = async (req, res) => {
  try {
    const journals = await Journal.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/auth/login');

    res.render('journal', { user, journals: journals || [] });

  } catch (error) {
    console.error('Journals error:', error.message);
    res.status(500).send(`
      <html>
        <body style="background:#080808;color:#F5F3EF;font-family:sans-serif;padding:40px;text-align:center;">
          <h2 style="color:#C9A84C;">改 KAIZEN</h2>
          <p>Journal temporarily unavailable.</p>
          <a href="/dashboard" style="color:#C9A84C;">← Back to Dashboard</a>
        </body>
      </html>
    `);
  }
};

module.exports = { getDashboard, addJournal, getJournals };
