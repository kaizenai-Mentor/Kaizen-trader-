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

  try {
    const {
      asset, timeframe, notes,
      emotion, ruleCompliance, direction,
      outcome, sessionScore
    } = req.body;

    if (!notes || notes.trim() === '') {
      return res.redirect('/dashboard/journal');
    }

    // Create journal entry
    const journal = await Journal.create({
      userId: req.session.user.id,
      asset: asset || 'General',
      timeframe: timeframe || 'N/A',
      notes: notes.trim(),
      emotion: emotion || 'Neutral',
      ruleCompliance: ruleCompliance === 'true',
      direction: direction || 'Live Trade',
      outcome: outcome || 'Pending',
      sessionScore: parseInt(sessionScore) || 50
    });

    console.log('Journal created:', journal._id);

    // Get user and ALL their past sessions
    const user = await User.findById(req.session.user.id);
    const allJournals = await Journal.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });

    // Update discipline score
    const compliantCount = allJournals.filter(j => j.ruleCompliance).length;
    const score = Math.round((compliantCount / allJournals.length) * 100);
    await User.findByIdAndUpdate(req.session.user.id, {
      disciplineScore: score
    });
    req.session.user.disciplineScore = score;

    // Build behavioral context from history
    const totalSessions = allJournals.length;
    const winRate = Math.round((compliantCount / totalSessions) * 100);
    const recentSessions = allJournals.slice(0, 10);
    const recentCompliant = recentSessions.filter(j => j.ruleCompliance).length;
    const recentTrend = recentCompliant > recentSessions.length * 0.6
      ? 'improving'
      : recentCompliant < recentSessions.length * 0.4
      ? 'declining'
      : 'inconsistent';

    // Find repeated patterns
    const allNotes = allJournals.map(j => j.notes.toLowerCase()).join(' ');
    const fomoCount = (allNotes.match(/fomo/gi) || []).length;
    const revengeCount = (allNotes.match(/revenge|frustrat/gi) || []).length;
    const assetsTraded = [...new Set(allJournals.map(j => j.asset))];

    // Build last 5 sessions summary for context
    const sessionHistory = allJournals.slice(0, 5).map((j, idx) => {
      return `Session ${idx + 1} (${new Date(j.createdAt).toLocaleDateString()}):
Asset: ${j.asset} | Compliant: ${j.ruleCompliance ? 'Yes' : 'No'} | Score: ${j.sessionScore}/100
Notes excerpt: ${j.notes.substring(0, 200)}`;
    }).join('\n\n');

    console.log('Building AI prompt with', totalSessions, 'sessions of history');

    // Generate AI response
    let aiResponse = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const https = require('https');

        const systemPrompt = `You are Kaizen — a world-class AI trading discipline mentor. You are direct, honest, deeply analytical, and genuinely care about this trader's long-term success. You are NOT generic. You reference specific details from their journal and their history.

TRADER PROFILE:
Name: ${user.username}
Total Sessions Logged: ${totalSessions}
Overall Discipline Score: ${score}/100
Overall Rule Compliance: ${winRate}%
Recent Trend (last 10): ${recentTrend}
Assets Traded: ${assetsTraded.join(', ')}
Primary Strategy: ${user.tradingStyle?.tradingEdge || 'Not specified'}
Max Risk Per Trade: ${user.tradingStyle?.riskPerTrade || 'Not specified'}%
Daily Loss Limit: ${user.tradingStyle?.dailyDrawdown || 'Not specified'}%
Entry Rule: ${user.tradingStyle?.entryRule || 'Not specified'}
Stop Loss Rule: ${user.tradingStyle?.stopLossRule || 'Not specified'}
Emotional Triggers (self-reported): ${user.tradingStyle?.emotionalTriggers || 'Not specified'}
Max Daily Trades: ${user.tradingStyle?.maxDailyTrades || 'Not specified'}
FOMO mentions across all sessions: ${fomoCount} times
Revenge trade mentions: ${revengeCount} times

RECENT SESSION HISTORY:
${sessionHistory || 'This is their first session.'}

YOUR RESPONSE RULES:
1. Reference SPECIFIC details from their journal entry — mention the actual pairs, prices, timeframes, strategy steps they wrote
2. Reference their HISTORY — if this is not their first session mention patterns you see across sessions
3. Never give the same response twice — every session is unique data
4. Be honest and direct — do not sugarcoat violations
5. Score strictly — a session with FOMO and a rule violation should score below 50
6. Keep total response under 400 words
7. End with exactly this format:
SESSION SCORE: [X]/100
DISCIPLINE IMPACT: [+X or -X] points
OVERALL SCORE: ${score}/100

Do NOT use bullet points or asterisks. Write in flowing paragraphs under clear section headers.`;

        const userMessage = `Current Session:
Asset: ${asset || 'Not specified'}
Session Type: ${direction || 'Live Trade'}
Followed ALL Rules: ${ruleCompliance === 'true' ? 'Yes' : 'No'}

Journal Entry:
${notes}`;

        const payload = JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }]
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
          req2.setTimeout(20000, () => {
            req2.destroy();
            reject(new Error('Timeout'));
          });

          req2.write(payload);
          req2.end();
        });

        const parsed = JSON.parse(response);
        if (parsed.content && parsed.content[0] && parsed.content[0].text) {
          aiResponse = parsed.content[0].text;
          console.log('Claude API response received successfully');
        } else if (parsed.error) {
          console.error('Claude API error:', parsed.error);
          aiResponse = buildFallbackResponse(
            notes, ruleCompliance === 'true',
            asset, user, totalSessions, recentTrend
          );
        }

      } catch (aiErr) {
        console.error('Anthropic call failed:', aiErr.message);
        aiResponse = buildFallbackResponse(
          notes, ruleCompliance === 'true',
          asset, user, totalSessions, recentTrend
        );
      }
    } else {
      console.log('No Anthropic key — using fallback');
      aiResponse = buildFallbackResponse(
        notes, ruleCompliance === 'true',
        asset, user, totalSessions, recentTrend
      );
    }

    // Update journal with AI analysis
    await Journal.findByIdAndUpdate(journal._id, {
      aiAnalysis: aiResponse
    });

    // Save to Memory
    try {
      const Memory = require('../models/Memory');
      await Memory.create({
        userId: req.session.user.id,
        sessionData: notes.substring(0, 500),
        response: aiResponse,
        asset: asset || 'General',
        sessionScore: parseInt(sessionScore) || 50
      });
      console.log('Saved to memories');
    } catch (memErr) {
      console.error('Memory save failed:', memErr.message);
    }

    // Store in session and redirect
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

function buildFallbackResponse(notes, compliant, asset, user, totalSessions, trend) {
  const score = compliant
    ? Math.floor(Math.random() * 20) + 65
    : Math.floor(Math.random() * 25) + 25;

  const hasFOMO = /fomo|fear of missing/i.test(notes);
  const hasRevenge = /revenge|frustrat|angry/i.test(notes);
  const hasLoss = /sl|stop loss|loss|losing/i.test(notes);
  const hasWin = /tp|take profit|profit|win/i.test(notes);
  const hasChecklist = /checklist|check list/i.test(notes);
  const isFirstSession = totalSessions <= 1;

  const sessionContext = isFirstSession
    ? 'This is your first logged session with Kaizen.'
    : `This is session ${totalSessions} in your Kaizen journey. Your discipline trend is ${trend}.`;

  const impact = compliant
    ? `+${Math.max(1, Math.floor(score / 25))}`
    : `-${Math.max(2, Math.floor((100 - score) / 15))}`;

  return `WHAT YOU DID WELL
${sessionContext} ${compliant
    ? `Following your rules on ${asset} — especially ${hasChecklist ? 'completing your full checklist before entry' : 'your entry criteria'} — is exactly the behavior that compounds into long-term profitability.`
    : `You documented this session with honesty. That takes more discipline than most traders show.`}

WHAT NEEDS IMPROVEMENT
${!compliant
    ? `A rule was violated this session. ${hasFOMO ? 'The FOMO on ' + asset + ' cost you a disciplined entry. FOMO is a pattern Kaizen will track closely across your sessions.' : 'Identify the exact decision point where the rule broke. That moment is where your focus belongs.'}
${hasLoss ? 'The stop loss hit is secondary — the process failure is what matters.' : ''}`
    : `${hasChecklist ? 'Your checklist discipline is building. The challenge now is maintaining it under pressure — when the market moves fast and FOMO appears.' : 'Continue documenting with this level of detail. The data builds over time.'}`}

EMOTIONAL PATTERN
${hasFOMO
    ? `FOMO appears directly in your writing around ${asset}. This is the third most common cause of account destruction among retail traders. It is your priority emotional work.`
    : hasRevenge
    ? 'Frustration is detectable in your writing. Trading from this emotional state multiplies risk significantly.'
    : hasLoss
    ? 'Your language around the loss is measured. Monitor how you feel going into your next session — post-loss decisions are where most discipline breaks.'
    : 'Your emotional state in this entry appears controlled. This is the foundation everything else is built on.'}

NEXT SESSION ACTION
${hasFOMO
    ? `Before your next ${asset} session: write "I will wait for the re-entry" on paper and place it next to your screen.`
    : !compliant
    ? 'Write your most violated rule at the top of your journal before you analyze a single chart tomorrow.'
    : 'Document your analysis reasoning before entry — not after. This forces clarity before emotion can interfere.'}

SESSION SCORE: ${score}/100
DISCIPLINE IMPACT: ${impact} points
OVERALL SCORE: ${user.disciplineScore || score}/100`;
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
