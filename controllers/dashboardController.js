const User = require('../models/User');
const Journal = require('../models/Journal');

const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);

    const allJournals = await Journal.find({
      userId: req.session.user.id
    }).sort({ createdAt: -1 });

    const journals = allJournals.slice(0, 10);

    let score = 0;
    if (allJournals.length > 0) {
      const compliant = allJournals.filter(j => j.ruleCompliance).length;
      score = Math.round((compliant / allJournals.length) * 100);
      await User.findByIdAndUpdate(req.session.user.id, {
        disciplineScore: score
      });
      req.session.user.disciplineScore = score;
    }

    let predictiveWarning = null;
    if (allJournals.length >= 5) {
      const recentFive = allJournals.slice(0, 5);
      const violations = recentFive.filter(j => !j.ruleCompliance).length;
      const allText = recentFive.map(j => j.notes.toLowerCase()).join(' ');
      const fomoCount = (allText.match(/fomo/gi) || []).length;
      const revengeCount = (allText.match(/revenge|frustrat/gi) || []).length;

      if (violations >= 3) {
        predictiveWarning = {
          message: `You have violated rules in ${violations} of your last 5 sessions. Review your entry criteria before opening any chart today.`,
          level: 'high'
        };
      } else if (fomoCount >= 2) {
        predictiveWarning = {
          message: 'FOMO has appeared repeatedly in your recent sessions. Stay off the charts until a valid setup forms.',
          level: 'medium'
        };
      } else if (revengeCount >= 1) {
        predictiveWarning = {
          message: 'Signs of frustration detected in recent sessions. Only trade if your emotional state is neutral today.',
          level: 'medium'
        };
      } else if (violations === 0 && recentFive.length === 5) {
        predictiveWarning = {
          message: 'Five consecutive compliant sessions. Your discipline is building. Protect this streak today.',
          level: 'positive'
        };
      }
    }

    res.render('dashboard', {
      user,
      journals,
      disciplineScore: score,
      totalSessions: allJournals.length,
      predictiveWarning
    });

  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.redirect('/auth/login');
  }
};

const addJournal = async (req, res) => {
  console.log('=== JOURNAL SUBMISSION START ===');

  try {
    const {
      notes,
      ruleCompliance,
      direction,
      timeframe,
      outcome,
      sessionScore
    } = req.body;

    if (!notes || notes.trim() === '') {
      return res.redirect('/dashboard/journal');
    }

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
    const overallScore = Math.round(
      (compliantCount / allJournals.length) * 100
    );

    const previousScore = req.session.user.disciplineScore || 0;

    await User.findByIdAndUpdate(req.session.user.id, {
      disciplineScore: overallScore
    });
    req.session.user.disciplineScore = overallScore;

    // Streak calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastSession = allJournals[1];

    if (ruleCompliance === 'true') {
      if (lastSession) {
        const lastDate = new Date(lastSession.createdAt);
        lastDate.setHours(0, 0, 0, 0);
        if (lastDate.getTime() === yesterday.getTime()) {
          await User.findByIdAndUpdate(req.session.user.id, {
            $inc: { streak: 1 }
          });
          req.session.user.streak = (req.session.user.streak || 0) + 1;
        } else if (lastDate.getTime() !== today.getTime()) {
          await User.findByIdAndUpdate(req.session.user.id, { streak: 1 });
          req.session.user.streak = 1;
        }
      } else {
        await User.findByIdAndUpdate(req.session.user.id, { streak: 1 });
        req.session.user.streak = 1;
      }
    } else {
      await User.findByIdAndUpdate(req.session.user.id, { streak: 0 });
      req.session.user.streak = 0;
    }

    // Build session history for AI context
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
      return `Past session ${i + 1} (${new Date(j.createdAt).toLocaleDateString()}): ${j.asset} | Compliant: ${j.ruleCompliance ? 'Yes' : 'No'} | "${j.notes.substring(0, 150)}"`;
    }).join('\n');

    let aiResponse = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const https = require('https');

        const systemPrompt = `You are Kaizen — an elite AI trading discipline mentor. You are direct, specific, deeply observant, and psychologically sophisticated. You are not a chatbot. You are a senior trader who has seen thousands of journals.

TRADER PROFILE:
Name: ${user.username}
Sessions logged: ${totalSessions}
Overall discipline: ${overallScore}%
Recent trend (last 10): ${recentTrend}
FOMO mentions all-time: ${fomoCount}
Revenge trade mentions: ${revengeCount}
Strategy: ${user.tradingStyle && user.tradingStyle.tradingEdge ? user.tradingStyle.tradingEdge : 'Not set'}
Max risk per trade: ${user.tradingStyle && user.tradingStyle.riskPerTrade ? user.tradingStyle.riskPerTrade : 'Not set'}%
Daily loss limit: ${user.tradingStyle && user.tradingStyle.dailyDrawdown ? user.tradingStyle.dailyDrawdown : 'Not set'}%
Entry rule: ${user.tradingStyle && user.tradingStyle.entryRule ? user.tradingStyle.entryRule : 'Not set'}
Stop loss rule: ${user.tradingStyle && user.tradingStyle.stopLossRule ? user.tradingStyle.stopLossRule : 'Not set'}
Known triggers: ${user.tradingStyle && user.tradingStyle.emotionalTriggers ? user.tradingStyle.emotionalTriggers : 'Not set'}

RECENT SESSION HISTORY:
${sessionHistory || 'This is their first session.'}

CRITICAL RESPONSE RULES:
1. Reference SPECIFIC details from their journal — actual pairs, prices, timeframes, strategy steps they mentioned
2. Do NOT always assume emotional causes — sometimes failures are technical (bad entry, wrong timeframe, misread structure). Identify the actual root cause accurately
3. Do NOT use the word emotional unless emotion is genuinely the root cause
4. Do NOT repeat advice from previous sessions — vary language and insights every single time
5. Do NOT give generic trading advice — only reference what THIS trader wrote in THIS session
6. Score strictly based on process adherence not outcome — 0 to 100
7. Maximum 300 words total
8. Use these flexible sections — only include what is relevant:

WHAT YOU EXECUTED WELL
[specific to their entry]

WHERE THE BREAKDOWN OCCURRED
[real cause — technical, behavioral, psychological, or situational]

PATTERN KAIZEN IS TRACKING
[only if genuine pattern exists across sessions]

ONE THING TO FOCUS ON
[single specific action — must vary every session]

${totalSessions === 1 ? `
SPECIAL INSTRUCTION — THIS IS THEIR FIRST SESSION:
Do not reference patterns across sessions because there are none yet.
Instead do three things:
1. Acknowledge this is their first log and what that means
2. Cross-reference their onboarding rules heavily — they set these rules 
   themselves, now check if this session honored them
3. End with "Here is what Kaizen will track from this session forward:" 
   and list 3 specific behavioral things you detected in this entry 
   that you will monitor going forward
This makes the first session feel valuable and sets up anticipation 
for future sessions.` : ''}

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

        console.log('Anthropic raw response:', response.substring(0, 200));

        const parsed = JSON.parse(response);
        if (parsed.content && parsed.content[0] && parsed.content[0].text) {
          aiResponse = parsed.content[0].text;
          console.log('Claude response received, length:', aiResponse.length);
        } else if (parsed.error) {
          console.error('Claude API error:', JSON.stringify(parsed.error));
          aiResponse = buildFallback(
            notes, ruleCompliance === 'true',
            asset, user, totalSessions, recentTrend, overallScore
          );
        }

      } catch (aiErr) {
        console.error('Anthropic call failed:', aiErr.message);
        aiResponse = buildFallback(
          notes, ruleCompliance === 'true',
          asset, user, totalSessions, recentTrend, overallScore
        );
      }
    } else {
      console.log('No ANTHROPIC_API_KEY — using fallback');
      aiResponse = buildFallback(
        notes, ruleCompliance === 'true',
        asset, user, totalSessions, recentTrend, overallScore
      );
    }

    // Extract session score from AI response
    let extractedScore = parseInt(sessionScore) || 50;
    const scoreMatch = aiResponse.match(/DISCIPLINE SCORE:\s*(\d+)%/i);
    if (scoreMatch && scoreMatch[1]) {
      extractedScore = parseInt(scoreMatch[1]);
    }

    await Journal.findByIdAndUpdate(journal._id, {
      aiAnalysis: aiResponse,
      sessionScore: extractedScore
    });

    // Save to Memory
    try {
      const Memory = require('../models/Memory');
      await Memory.create({
        userId: req.session.user.id,
        sessionData: notes.substring(0, 500),
        response: aiResponse,
        asset,
        sessionScore: extractedScore
      });
      console.log('Memory saved');
    } catch (memErr) {
      console.error('Memory save failed:', memErr.message);
    }

    // Mantle on-chain recording
    try {
      const mantle = require('../config/mantle');
      await mantle.recordScoreChange(
        req.session.user.id,
        previousScore,
        overallScore,
        ruleCompliance === 'true' ? 'Compliant session' : 'Rule violation'
      );
      if (fomoCount >= 3) {
        await mantle.recordPattern(
          req.session.user.id, 'FOMO', 'high'
        );
      }
      if (totalSessions === 10) {
        await mantle.recordMilestone(
          req.session.user.id, '10_sessions', overallScore
        );
      }
      if (overallScore >= 80 && previousScore < 80) {
        await mantle.recordMilestone(
          req.session.user.id, 'elite_tier_reached', overallScore
        );
      }
    } catch (mantleErr) {
      console.error('Mantle error:', mantleErr.message);
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

function buildFallback(notes, compliant, asset, user, totalSessions, trend, overallScore) {
  const score = compliant
    ? Math.floor(Math.random() * 15) + 68
    : Math.floor(Math.random() * 20) + 28;

  const hasFOMO = /fomo|fear of missing/i.test(notes);
  const hasRevenge = /revenge|frustrat|angry/i.test(notes);
  const hasLoss = /sl|stop loss|loss|losing|blew|blow/i.test(notes);
  const hasWin = /tp|take profit|profit|win|hit tp/i.test(notes);
  const hasChecklist = /checklist|check list|confirmed|mss|sweep/i.test(notes);
  const hasProp = /prop|funded|account/i.test(notes);
  const isFirst = totalSessions <= 1;

  const impact = compliant
    ? `+${Math.max(1, Math.floor(score / 25))}%`
    : `-${Math.max(2, Math.floor((100 - score) / 15))}%`;

  // WHAT YOU EXECUTED WELL
  const wellDone = compliant
    ? hasChecklist
      ? `The checklist discipline on ${asset} is exactly the behavior that separates developing traders from consistent ones. Completing every confirmation step before entry — sweep, MSS, timeframe alignment — is what gives your strategy its edge. When you follow the process completely the outcome takes care of itself.`
      : `Following your rules on ${asset} this session is the foundation everything else is built on. One compliant session builds the habit. Ten compliant sessions builds the trader. You are moving in the right direction.`
    : `You documented this session honestly without excuses or justification. That level of self-awareness is rarer than most traders admit. The traders who improve fastest are the ones who can name exactly what went wrong without blaming the market.`;

  // WHERE THE BREAKDOWN OCCURRED
  const breakdown = !compliant
    ? hasFOMO
      ? `The breakdown was behavioral — FOMO overrode your confirmation process on ${asset}. You had the right bias and the right zone. The entry came before your trigger fired. This is not a technical analysis failure. This is an execution failure at the final decision point, and it has a specific name: participation bias. You entered to participate, not because your rules said to.`
      : hasLoss
      ? `A rule was bypassed this session on ${asset}. The stop loss hit is the consequence, not the problem. The problem is the decision that came before it — the moment you entered without full confirmation. Identify that exact moment. Write down what you were feeling in the seconds before you clicked. That feeling is your signal to wait, not to act.`
      : `Something overrode your process this session. Whether it was speed, conviction, or external noise — the entry did not match your defined criteria. Before your next session identify the exact rule that was skipped and under what condition it happened.`
    : hasWin
    ? `No critical breakdown this session. The process held together and the outcome reflected it. The challenge now is not getting better — it is staying consistent when the market makes it harder. Winning sessions can create overconfidence in the next one. Watch for that.`
    : `No rule violations detected. This is what a clean session looks like. Study it. Understand what made it easy to follow your rules today so you can replicate that state tomorrow.`;

  // PATTERN KAIZEN IS TRACKING
  let pattern = '';
  if (totalSessions >= 3) {
    if (hasFOMO) {
      pattern = `\n\nPATTERN KAIZEN IS TRACKING\nFOMO has appeared in your recent sessions. This is becoming a documented behavioral pattern, not a one-time mistake. Kaizen is watching which pairs and which market conditions trigger it most frequently. Keep logging with this level of detail — the data is building.`;
    } else if (hasRevenge) {
      pattern = `\n\nPATTERN KAIZEN IS TRACKING\nSigns of frustration have appeared across recent sessions. Trading from an agitated emotional state is one of the highest-risk behavioral patterns Kaizen monitors. Note the time of day and market conditions when this appears — there is likely a trigger condition worth identifying.`;
    } else if (!compliant && trend === 'declining') {
      pattern = `\n\nPATTERN KAIZEN IS TRACKING\nYour compliance rate has been declining across recent sessions. This is the early signal of a behavioral drift — where shortcuts become habits. Kaizen is flagging this now so you can course-correct before it compounds.`;
    } else if (compliant && trend === 'improving') {
      pattern = `\n\nPATTERN KAIZEN IS TRACKING\nYour compliance rate has been improving across recent sessions. This is the compounding effect of discipline in action. The traders who reach Elite tier are the ones who notice this trend and protect it deliberately.`;
    }
  } else if (isFirst) {
    pattern = `\n\nWHAT KAIZEN WILL TRACK FROM HERE\nBased on this first session, Kaizen is now monitoring: your rule compliance rate, any FOMO or emotional override patterns, your checklist completion consistency, and which assets and conditions trigger your strongest responses. Every session you log makes this picture sharper. Aim for 10 sessions — that is when the pattern data becomes genuinely useful.`;
  }

  // ONE THING TO FOCUS ON
  const focus = hasFOMO
    ? `Before your next ${asset} session, after your final higher timeframe confirmation, set a physical timer for 3 minutes. Do nothing. If your entry trigger fires during those 3 minutes you enter. If it does not, you walk away. Three minutes of patience has a higher expected value than any premature entry.`
    : hasLoss && hasProp
    ? `With a funded account the psychological weight of each loss is amplified. Before your next session write down your maximum loss for the day and close the platform the moment you hit it. One rule. Non-negotiable. Protect the account first.`
    : !compliant
    ? `Write the rule you violated today at the top of tomorrow's journal before you open any chart. Read it out loud. Then trade. The act of naming it before the session is more powerful than reviewing it after.`
    : isFirst
    ? `For your next session, include the specific entry price, stop loss level, and take profit target in your notes. The more specific your data, the more specific Kaizen's feedback becomes.`
    : `Log your next session within 30 minutes of finishing it. The emotional and analytical detail fades fast. The closer to real-time your journaling is, the more accurate the data KAIZEN builds on.`;

  return `WHAT YOU EXECUTED WELL
${wellDone}

WHERE THE BREAKDOWN OCCURRED
${breakdown}${pattern}

ONE THING TO FOCUS ON
${focus}

DISCIPLINE SCORE: ${score}%
OVERALL SCORE: ${overallScore}%`;
}

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
          <a href="/dashboard" style="color:#C9A84C;">Back to Dashboard</a>
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
