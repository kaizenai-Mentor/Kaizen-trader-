/**
 * KAIZEN AI Coach — V2 prompt & deep-interpretation contract.
 *
 * CORE PRINCIPLE (owner directive 21 Oct 2026):
 *   "The trader documents the session. KAIZEN interprets it."
 *   Never ask the trader to classify their own behavior first.
 *   Understand why the trader made each decision before judging it.
 *
 * WHAT KAIZEN READS FOR:
 *   chronology · causality · intention · justification · discipline ·
 *   emotional context · contradictions · consistency with previous sessions
 *
 * 6-STEP INTERNAL COACHING FRAMEWORK:
 *   Step 1 — Understand the trader's objective (intended trade, declared rules, success criteria)
 *   Step 2 — Understand the story (what happened first, what happened next, what changed, what evidence caused it)
 *   Step 3 — Understand behaviour (discipline, hesitation, fear, confidence, revenge, overconfidence, patience)
 *   Step 4 — Understand reasoning (objective market-structure justification vs emotional impulse; plan revision vs deviation)
 *   Step 5 — Compare (against the written plan, trading system, previous behaviour, recurring mistakes, and goals)
 *   Step 6 — Respond like a coach (Session Summary, What I noticed, What concerns me, What you did well, Your next improvement)
 */

const llm = require('./llm');
const i18n = require('../config/locales');
const cleanText = require('./cleanText');

// ── Deep Journal Interpretation Patterns ─────────────────────────

const DIRECTION_CHANGE_RE = /\b(switched to (a )?(sell|buy|short|long)|flipped (to|my )?(sell|buy|short|long|bias)|changed (my )?(bias|plan|direction|thesis)|revised (my )?(plan|thesis|bias)|instead of (buying|selling|going long|going short)|planned (a |to )?(buy|sell|long|short)\b[\s\S]{0,220}\b(switched|took|executed|entered|flipped) (to )?(a )?(sell|buy|short|long))\b/i;

const OBJECTIVE_EVIDENCE_RE = /\b(stud(ied|ying)|observ(ed|ing)|failed to break|previous (high|low)|weekend structure|market structure|structure (shifted|broke|failed|held)|higher timeframe|htf|liquidity (sweep|raid|grab)|swept|invalidat(ed|ion)|confirmation (candle|close)|candle close|mss|bos|choch|rejected (at|from)|supply|demand|key level|session (high|low)|order block|fair value gap|fvg)\b/i;

const VALIDATION_RE = /\b(cross[- ]?check(ed)?|validated|re-?evaluated|re-?assessed|checked my (bias|rules|plan)|waited for|confirmed|aligned with|after studying|after observing)\b/i;

const EMOTIONAL_IMPULSE_RE = /\b(revenge|fomo|chased|chasing|frustrat(ed|ing|ion)|angry|anger|tilt(ed)?|panic(ked)?|impuls(ive|ively)|bored(om)?|moved my stop|widened (my )?stop|doubled (down|my size)|oversiz(ed|ing)|couldn'?t wait|entered early|jumped in|greed(y)?)\b/i;

const PATIENCE_RE = /\b(waited|patient(ly)?|stood aside|skipped (the|a) (late|bad|forced)|respected (my )?(risk|stop|rules)|stayed inside|followed (my )?(plan|rules)|confirmation candle|walked away|held to|sized in properly)\b/i;

const HESITATION_RE = /\b(hesitat(ed|ion)|froze|freeze|second[- ]?guess(ed)?|afraid|fear|scared|anxious|doubt(ed)?|almost added)\b/i;

/**
 * Internally reason through a session journal using the 6-step coaching
 * framework: chronology, causality, intention, justification, discipline,
 * emotional context, contradictions, and consistency with previous sessions.
 */
function interpretJournal(session = {}, context = {}) {
  const p = session.plan || {};
  const q = session.quickChecks || {};
  const refl = session.reflection || {};
  const notes = String(session.notes || '').trim();
  const fullText = [
    p.setup, p.entryCondition, p.invalidation,
    notes,
    refl.whatHappened, refl.followedProcess, refl.learned, refl.wouldChange
  ].filter(Boolean).join(' ');

  const planned = Boolean(session.plan && !session.plan.skipped);
  const followedPlanCheck = q.followedPlan === 'YES';
  const brokePlanCheck = q.followedPlan === 'NO';
  const respectedRiskCheck = q.respectedRisk !== 'NO';
  const withinEntryCheck = q.withinEntryCriteria !== 'NO';

  // Chronology: split the journal into ordered clauses
  const clauses = notes
    .split(/(?<=[.!?])\s+|\bthen\b|\bafter that\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  const hasDirectionChange = DIRECTION_CHANGE_RE.test(fullText);
  const hasObjectiveEvidence = OBJECTIVE_EVIDENCE_RE.test(fullText);
  const hasValidation = VALIDATION_RE.test(fullText);
  const hasEmotionalImpulse = EMOTIONAL_IMPULSE_RE.test(fullText);
  const hasPatience = PATIENCE_RE.test(fullText);
  const hasHesitation = HESITATION_RE.test(fullText);

  // Distinguish a reasoned Plan Revision from an Emotional Deviation:
  // If direction/plan changed (or followedPlan was marked NO while adapting),
  // AND the trader documented objective market structure / invalidation evidence
  // AND validated/cross-checked bias without emotional impulse -> Disciplined Plan Revision.
  const isPlanRevision = Boolean(
    (hasDirectionChange || (brokePlanCheck && hasValidation)) &&
    hasObjectiveEvidence &&
    (hasValidation || clauses.length >= 2) &&
    !hasEmotionalImpulse
  );

  const isEmotionalDeviation = Boolean(
    !isPlanRevision && (hasEmotionalImpulse || brokePlanCheck || q.respectedRisk === 'NO' || q.withinEntryCriteria === 'NO')
  );

  // Detect contradictions between pre-session state, checks, and written narrative
  const contradictions = [];
  if (p.confidence && Number(p.confidence) >= 7 && (hasHesitation || hasEmotionalImpulse)) {
    contradictions.push(
      `Your pre-session confidence was ${p.confidence}/10 (${p.emotionalState || 'calm'}), yet your journal notes in-session impulse or hesitation — watch that gap between pre-trade certainty and live execution.`
    );
  }
  if (followedPlanCheck && hasEmotionalImpulse) {
    contradictions.push(
      'You marked your plan check as followed, but your written notes describe an impulsive adjustment during the session.'
    );
  }

  // Consistency with previous sessions
  const recent = Array.isArray(context.recentSessions) ? context.recentSessions : [];
  const checkedRecent = recent.filter(s => s && (s.ruleCompliance === true || s.ruleCompliance === false));
  const keptRecent = checkedRecent.filter(s => s.ruleCompliance === true).length;

  let classification = 'DISCIPLINED_EXECUTION';
  if (!planned) classification = 'UNPLANNED_SESSION';
  else if (isPlanRevision) classification = 'DISCIPLINED_PLAN_REVISION';
  else if (isEmotionalDeviation) classification = 'EMOTIONAL_DEVIATION';

  return {
    planned,
    clauses,
    classification,
    isPlanRevision,
    isEmotionalDeviation,
    hasDirectionChange,
    hasObjectiveEvidence,
    hasValidation,
    hasEmotionalImpulse,
    hasPatience,
    hasHesitation,
    followedPlanCheck,
    brokePlanCheck,
    respectedRiskCheck,
    withinEntryCheck,
    contradictions,
    consistency: {
      checked: checkedRecent.length,
      kept: keptRecent
    }
  };
}

function planSummary(session) {
  const p = session.plan || {};
  if (p.skipped) return 'No plan on record (honest skip).';
  return [
    `Setup: ${p.setup || 'not stated'}`,
    `Entry condition: ${p.entryCondition || 'not stated'}`,
    `Invalidation: ${p.invalidation || 'not stated'}`,
    `Predefined risk: ${p.predefinedRisk || 'not stated'}`,
    `Emotional state before: ${p.emotionalState || 'not stated'}${p.confidence ? ` (confidence ${p.confidence}/10)` : ''}`
  ].join('\n');
}

function checksSummary(session) {
  const q = session.quickChecks || {};
  const row = (label, v) => `${label}: ${v || 'not mentioned'}`;
  return [
    row('Followed plan', q.followedPlan),
    row('Within entry criteria', q.withinEntryCriteria),
    row('Respected risk', q.respectedRisk),
    `Outcome: ${session.outcome || 'not mentioned'}`
  ].join('\n');
}

function buildSystemPrompt({ user, system, session, recentHistory, scoreBrief, mindState, goals }) {
  const ts = system || {};
  const risk = ts.riskRules || {};
  const interp = interpretJournal(session);
  const activeGoals = Array.isArray(goals) && goals.length
    ? goals.filter(g => g && g.status === 'ACTIVE').map(g => `- ${g.title}${g.rationale ? ` (why: ${g.rationale})` : ''}`).join('\n')
    : '';
  const activeThemes = mindState && Array.isArray(mindState.themes) && mindState.themes.length
    ? mindState.themes.filter(t => t && t.status !== 'resolved').map(t => `- ${t.name} [${t.status}]`).join('\n')
    : '';

  return `You are KAIZEN — an elite AI trading accountability coach and mentor. You are direct, specific, deeply observant, and psychologically sophisticated. You are not a chatbot, not a plain journal, and not an analytics report. You are a senior trading mentor who has read thousands of journals.

CORE PRODUCT PRINCIPLE:
The trader documents the session. KAIZEN interprets it.
Never ask the trader to classify their own behavior first. Understand why the trader made each decision before judging it.

DEEP JOURNAL READING:
Read the journal like an experienced trading mentor. Do not only detect keywords — understand:
- chronology (what happened first, what happened next)
- causality (what evidence or trigger caused each decision)
- intention (what the trader set out to do)
- justification (whether decisions were backed by objective market structure or driven by emotion)
- discipline (how they held their rules and risk)
- emotional context (hesitation, fear, confidence, revenge, overconfidence, patience)
- contradictions (between declared plan, confidence, quick checks, and written notes)
- consistency with previous sessions

INTERNAL 6-STEP COACHING FRAMEWORK (process every session through these 6 steps before writing):
Step 1 — Understand the trader's objective: What was the intended trade? What rules were declared? What was success supposed to look like?
Step 2 — Understand the story: What happened first? What happened next? What changed? What evidence caused those changes?
Step 3 — Understand behaviour: Was the trader disciplined? Was there hesitation, fear, confidence, revenge, overconfidence, or patience?
Step 4 — Understand reasoning: Was every major decision justified? Were explanations objective or emotional? CRITICAL: If the trader changed direction or evolved their plan after observing objective market structure (e.g. price failed to break a high/low, structure shifted, bias was cross-checked) without emotional impulse, recognize it as a disciplined adjustment rather than an emotional deviation.
Step 5 — Compare: Compare actions against the written plan, their trading system, their previous behaviour, their recurring mistakes, and their goals.
Step 6 — Only then respond: Never respond with a shallow "You deviated." Respond like a coach in a conversation — show you understood what happened, where their process remained disciplined, where it weakened, and the single improvement to make next.

TRADER PROFILE:
Name: ${(user && user.username) || 'Trader'}
Session type: ${session.sessionType}
Strategy: ${ts.entryRules || 'Not set'}
Risk rules: ${risk.riskPerTrade || 'not set'}% per trade, ${risk.dailyDrawdown || 'not set'}% daily drawdown, ${risk.maxDailyTrades || 'not set'} max trades/day
No-trade conditions: ${(ts.noTradeConditions || []).join('; ') || 'Not set'}
Psychological rules: ${(ts.psychologicalRules || []).join('; ') || 'Not set'}
${activeGoals ? `Active goals:\n${activeGoals}\n` : ''}${activeThemes ? `Recurring psychological themes:\n${activeThemes}\n` : ''}
THEIR DECLARED PLAN (before the trade):
${planSummary(session)}

WHAT THEY RECORDED (after the trade):
${checksSummary(session)}

Freeform journal:
"${session.notes || ''}"

THEIR OWN REFLECTION (their words, respond to it):
What happened: ${(session.reflection && session.reflection.whatHappened) || ''}
Did they follow their process: ${(session.reflection && session.reflection.followedProcess) || ''}
What they learned: ${(session.reflection && session.reflection.learned) || ''}
What they would change: ${(session.reflection && session.reflection.wouldChange) || ''}

RECENT SESSION HISTORY:
${recentHistory || 'This is their first session.'}

ENGINE SUMMARY (deterministic, for your context only — never quote numbers as a score):
${scoreBrief}
PRELIMINARY INTERPRETATION HINT: ${interp.classification}${interp.isPlanRevision ? ' (Documented thesis revision based on market structure analysis — treat as a disciplined adjustment, not an emotional deviation)' : ''}

CRITICAL RESPONSE RULES:
1. Understand why the trader made each decision before judging it — compare the PLAN with the RECORD and read the chronology and justification in their journal.
2. Reference SPECIFIC details from their writing — actual pairs, prices, timeframes, and the sequence of decisions.
3. Do NOT assume emotional causes — identify the actual root cause (technical, behavioral, psychological, or a reasoned plan revision).
4. Do NOT repeat advice from previous sessions.
5. For BACKTEST sessions: coach the process of identifying setups — practice quality is the subject.
6. For STUDY sessions: coach the observation and the decision NOT to trade, when that's what happened.
7. Maximum 320 words. No asterisks, no markdown formatting. Use the conversational coaching sections below.
8. GROUNDING (frozen): any conclusion about their discipline or improvement must rest on measured behavior — their quick checks, rule compliance, and the engine summary. A well-written journal entry is never evidence of discipline. If the record does not support a conclusion, say what the record shows instead.
9. LANGUAGE: always write the analysis in English. The EXTRACTED line stays English (rule below) — it must remain parseable.
10. VOICE: speak TO them, never ABOUT them. Second person, with explicit possession on everything that belongs to them — "your execution", "your risk", "your plan", "your sizing", "you entered". Never write bare abstract nouns where the possession matters ("execution will improve" → "your execution will improve"; "discipline held" → "your discipline held"). They must feel spoken to, not described.

SESSION SUMMARY
[One concise paragraph showing you understood what happened and why.]

WHAT I NOTICED
- [Observation 1 from their chronology, setup, or execution]
- [Observation 2 from their reasoning, justification, or rules]
- [Observation 3 from their emotional context or consistency across sessions]

WHAT CONCERNS ME
[One or two important issues where your process weakened — or the main risk to guard against next if execution was clean.]

WHAT YOU DID WELL
[Always reinforce disciplined behavior where deserved — grounded in what you actually did.]

YOUR NEXT IMPROVEMENT
[One clear action for your very next session. Not five. Not seven. One.]

At the very end add this line with facts extracted from their writing (or N/A). It is machine-parsed: always write this line in English and in exactly this format, whatever language the analysis is in:
EXTRACTED: outcome=[Win/Loss/Breakeven/No Trade] rr=[e.g. 1:2.5 or N/A] pips=[e.g. +45 or N/A]`;
}

/**
 * Build the structured 5-part conversational Session Review deterministically
 * using the 6-step coaching framework and deep journal interpretation.
 */
function buildSessionReview(session = {}, context = {}) {
  const interp = interpretJournal(session, context);
  const p = session.plan || {};
  const refl = session.reflection || {};
  const notes = String(session.notes || '').trim();
  const snippet = notes.split(/\s+/).slice(0, 14).join(' ');
  const asset = session.asset && session.asset !== 'General' ? session.asset : null;
  const setup = p.setup || '';

  // 1. Session Summary (one concise paragraph)
  let summary = '';
  if (interp.isPlanRevision) {
    summary = 'Your original plan evolved after additional market analysis. Based on your explanation, this appears to be a disciplined adjustment rather than an emotional deviation. Going forward, continue documenting what invalidated the original thesis so your decision-making process becomes even more consistent.';
  } else if (!interp.planned) {
    summary = `You logged ${asset ? `your ${asset} session` : 'this session'} honestly without a pre-session plan${snippet ? ` ("${snippet}")` : ''}. Documenting an unplanned session takes honesty, and it gives us a clear starting point — but without a declared plan before entry, your execution has no anchor to be measured against.`;
  } else if (interp.isEmotionalDeviation) {
    summary = `You came in with a declared plan${setup ? ` (${setup})` : ''}${asset ? ` on ${asset}` : ''}, but during the session your execution drifted away from what you declared${snippet ? ` — "${snippet}"` : ''}. Understanding the exact moment your process weakened is more valuable than the outcome itself.`;
  } else {
    summary = `You declared your plan${setup ? ` (${setup})` : ''}${asset ? ` on ${asset}` : ''} before the session and executed inside the boundaries you set${snippet ? ` — "${snippet}"` : ''}. Your chronology from preparation to execution stayed aligned with your rules.`;
  }

  // 2. What I noticed (3 to 4 specific observations)
  const noticed = [];
  if (interp.isPlanRevision) {
    noticed.push('You observed new market structure evidence before acting rather than forcing your initial thesis.');
    noticed.push('You cross-checked your bias against what price was actually doing before switching direction.');
    noticed.push('Your explanation references objective structure and invalidation rather than frustration or impulse.');
  } else {
    if (notes) {
      noticed.push(
        asset
          ? `On ${asset}, you documented: "${snippet}${notes.split(/\s+/).length > 14 ? '…' : ''}".`
          : `In your journal, you documented: "${snippet}${notes.split(/\s+/).length > 14 ? '…' : ''}".`
      );
    } else {
      noticed.push('Your session record is brief — adding the sequence of what you saw first and what triggered your decision will sharpen future reviews.');
    }

    if (interp.planned) {
      noticed.push(
        setup
          ? `Your declared setup was "${setup}"${p.predefinedRisk ? ` with predefined risk at ${p.predefinedRisk}` : ''}.`
          : `You locked in a pre-session plan before entering the market.`
      );
    } else {
      noticed.push('You entered the session without locking in a written pre-session plan first.');
    }

    if (interp.contradictions.length) {
      noticed.push(interp.contradictions[0]);
    } else if (refl && refl.learned) {
      noticed.push(`In your reflection, you noted the key takeaway in your own words: "${cleanText(refl.learned)}".`);
    } else if (interp.hasPatience) {
      noticed.push('Your notes show patience in waiting for your criteria before committing risk.');
    } else if (interp.hasEmotionalImpulse) {
      noticed.push('Your wording points to an in-session impulse overtaking the rule you set beforehand.');
    } else {
      noticed.push(`Your quick checks recorded: plan ${session.quickChecks && session.quickChecks.followedPlan ? session.quickChecks.followedPlan : 'not mentioned'}, risk ${session.quickChecks && session.quickChecks.respectedRisk ? session.quickChecks.respectedRisk : 'not mentioned'}.`);
    }
  }
  if (interp.consistency.checked > 0 && noticed.length < 4) {
    noticed.push(`Across your recent record, you have stayed inside your rules in ${interp.consistency.kept} of ${interp.consistency.checked} checked sessions.`);
  }

  // 3. What concerns me (1 or 2 important issues)
  let concerns = '';
  if (interp.isPlanRevision) {
    concerns = 'Even when a thesis revision is justified by structure, changing direction mid-session can blur the line between adaptation and improvisation if the exact invalidation point of the first idea is not written down before flipping.';
  } else if (!interp.planned) {
    concerns = 'Trading without a written plan forces you to make both the analysis decision and the risk decision in the heat of live price movement, which is where avoidable mistakes start.';
  } else if (interp.isEmotionalDeviation) {
    concerns = interp.contradictions[0] ||
      'The gap between the rule you declared before the session and the decision made once price started moving — when a rule bends mid-session, the next trade becomes harder to govern.';
  } else if (interp.contradictions.length) {
    concerns = interp.contradictions[0];
  } else {
    concerns = 'Clean sessions can quietly breed overconfidence on the very next trade. Guard against relaxing your entry checklist tomorrow just because today felt controlled.';
  }

  // 4. What you did well (reinforce disciplined behavior where deserved)
  let didWell = '';
  if (interp.isPlanRevision) {
    didWell = 'You did not marry your original bias when the market structure invalidated it — you read the new evidence objectively, validated your thesis, and documented the reasoning clearly.';
  } else if (interp.planned && interp.followedPlanCheck && interp.respectedRiskCheck) {
    didWell = 'You declared this trade before entering it and then traded it as declared. That closed loop — plan, execute, record — is the discipline your edge depends on.';
  } else if (!interp.planned) {
    didWell = 'You logged the session honestly, including trading without a plan. Honest records beat flattering ones — this entry is usable.';
  } else if (interp.respectedRiskCheck) {
    didWell = 'You planned before entering and kept your risk inside boundaries, which kept the session survivable and reviewable.';
  } else {
    didWell = 'You wrote down what actually happened instead of hiding the session — self-awareness in the journal is where every behavioral correction begins.';
  }

  // 5. Your next improvement (ONE clear action)
  let nextImprovement = '';
  if (interp.isPlanRevision) {
    nextImprovement = 'Before executing a thesis revision in your next session, write one sentence naming the exact level or candle close that invalidated your original plan.';
  } else if (!interp.planned) {
    nextImprovement = 'Make your next session a planned one — declare the setup, invalidation, and risk before you enter. Thirty seconds, before the trade.';
  } else if (interp.isEmotionalDeviation) {
    nextImprovement = setup
      ? `Before your next entry, reread your declared rule — "${setup}" — and if price has not met every clause, stand aside for 15 minutes before touching the order button.`
      : 'Reread your declared invalidation before your next entry and trade the written plan — or close the chart for 15 minutes if you feel the urge to force it.';
  } else {
    nextImprovement = 'Repeat this exact loop in your next session: declare the setup and invalidation beforehand, execute only when confirmed, and close the session the moment your plan is complete.';
  }

  return {
    summary,
    noticed,
    concerns,
    didWell,
    nextImprovement,
    interpretation: interp
  };
}

function buildFallback(session = {}, lang = 'en', context = {}) {
  // Always English (owner directive 19 Oct 2026)
  const review = buildSessionReview(session, context);
  const parts = [
    'SESSION SUMMARY\n' + review.summary,
    'WHAT I NOTICED\n' + review.noticed.map(item => '- ' + item).join('\n'),
    'WHAT CONCERNS ME\n' + review.concerns,
    'WHAT YOU DID WELL\n' + review.didWell,
    'YOUR NEXT IMPROVEMENT\n' + review.nextImprovement,
    'EXTRACTED: outcome=' + (session.outcome || 'N/A') + ' rr=N/A pips=N/A'
  ];
  return parts.join('\n\n');
}

/**
 * Parse any session analysis text (new 5-section conversational format,
 * legacy 3-section format, or plain prose) into the 5 conversational
 * coaching sections for views/session-detail.ejs.
 */
function parseSessionReview(text, session = {}, context = {}) {
  const raw = cleanText(stripExtracted(text || ''));
  const fallback = buildSessionReview(session, context);
  if (!raw) return fallback;

  const summaryMatch = raw.match(/SESSION SUMMARY\s*:?\s*\n+([\s\S]*?)(?=\n+\s*WHAT I NOTICED|\n+\s*WHAT CONCERNS ME|$)/i);
  const noticedMatch = raw.match(/WHAT I NOTICED\s*:?\s*\n+([\s\S]*?)(?=\n+\s*WHAT CONCERNS ME|\n+\s*WHAT YOU DID WELL|$)/i);
  const concernsMatch = raw.match(/WHAT CONCERNS ME\s*:?\s*\n+([\s\S]*?)(?=\n+\s*WHAT YOU DID WELL|\n+\s*YOUR NEXT IMPROVEMENT|$)/i);
  const didWellMatch = raw.match(/WHAT YOU DID WELL\s*:?\s*\n+([\s\S]*?)(?=\n+\s*YOUR NEXT IMPROVEMENT|\n+\s*ONE THING TO FOCUS ON|$)/i);
  const nextMatch = raw.match(/YOUR NEXT IMPROVEMENT\s*:?\s*\n+([\s\S]*?)$/i);

  if (summaryMatch || noticedMatch || concernsMatch || didWellMatch || nextMatch) {
    const noticedLines = noticedMatch
      ? noticedMatch[1]
          .split('\n')
          .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
          .filter(Boolean)
      : fallback.noticed;
    return {
      summary: (summaryMatch && summaryMatch[1].trim()) || fallback.summary,
      noticed: noticedLines.length ? noticedLines.slice(0, 4) : fallback.noticed,
      concerns: (concernsMatch && concernsMatch[1].trim()) || fallback.concerns,
      didWell: (didWellMatch && didWellMatch[1].trim()) || fallback.didWell,
      nextImprovement: (nextMatch && nextMatch[1].trim()) || fallback.nextImprovement,
      interpretation: fallback.interpretation
    };
  }

  // Legacy format ("WHAT YOU EXECUTED WELL / WHERE THE BREAKDOWN OCCURRED / ONE THING TO FOCUS ON")
  // or freeform single-paragraph analysis: map cleanly into the 5 conversational sections.
  const legWell = raw.match(/WHAT YOU EXECUTED WELL\s*\n+([\s\S]*?)(?=\n+\s*WHERE THE BREAKDOWN OCCURRED|\n+\s*THE PATTERN|\n+\s*ONE THING TO FOCUS ON|$)/i);
  const legBreak = raw.match(/WHERE THE BREAKDOWN OCCURRED\s*\n+([\s\S]*?)(?=\n+\s*THE PATTERN|\n+\s*ONE THING TO FOCUS ON|$)/i);
  const legFocus = raw.match(/ONE THING TO FOCUS ON\s*\n+([\s\S]*?)$/i);

  if (legWell || legBreak || legFocus) {
    const pre = raw.split(/WHAT YOU EXECUTED WELL/i)[0].trim();
    return {
      summary: pre || fallback.summary,
      noticed: fallback.noticed,
      concerns: (legBreak && legBreak[1].trim()) || fallback.concerns,
      didWell: (legWell && legWell[1].trim()) || fallback.didWell,
      nextImprovement: (legFocus && legFocus[1].trim()) || fallback.nextImprovement,
      interpretation: fallback.interpretation
    };
  }

  // Plain prose paragraph(s) (e.g. demo or older stored strings)
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  return {
    summary: raw,
    noticed: sentences.length >= 2 ? sentences.slice(0, 3) : fallback.noticed,
    concerns: fallback.concerns,
    didWell: fallback.didWell,
    nextImprovement: fallback.nextImprovement,
    interpretation: fallback.interpretation
  };
}

/** Extract structured facts from the AI response tail (engine input fallback). */
function parseExtracted(text) {
  const m = String(text || '').match(/EXTRACTED:\s*outcome=([^\s]+)\s+rr=([^\s]+)\s+pips=([^\s]+)/i);
  if (!m) return null;
  return { outcome: m[1], rr: m[2], pips: m[3] };
}

/** Strip the EXTRACTED line from what the user sees. */
function stripExtracted(text) {
  return String(text || '').replace(/EXTRACTED:.*$/i, '').trim();
}

/**
 * Analyze a completed session. Returns the coaching text (EXTRACTED line
 * stripped for display; parse it first via parseExtracted).
 */
async function analyzeSession({ session, user, system, recentSessions, mindState, goals }) {
  if (!llm.available()) {
    return buildFallback(session, i18n.normalize(user && user.preferredLang), { system, recentSessions, mindState, goals });
  }
  const prep = prepareAnalysis({ session, user, system, recentSessions, mindState, goals });
  return llm.callLLM(prep.systemPrompt, prep.messageContent, { maxTokens: 900 });
}

/** Shared prompt construction for analyzeSession / streamAnalysis. */
function prepareAnalysis({ session, user, system, recentSessions, mindState, goals }) {
  const recentHistory = (recentSessions || []).slice(-10).reverse().map(s =>
    `- ${new Date(s.createdAt).toISOString().slice(0, 10)} [${s.sessionType}] ${s.outcome || ''}: ${(s.notes || '').slice(0, 140)}`
  ).join('\n');

  const scoreBrief = 'Score computed separately by the engine.';
  const messageContent = [{ type: 'text', text: 'Analyze this completed session.' }];
  const systemPrompt = buildSystemPrompt({ user, system, session, recentHistory, scoreBrief, mindState, goals });
  return { systemPrompt, messageContent };
}

/**
 * Streaming variant of analyzeSession - yields coaching text chunks.
 * Same contract; without a provider key it yields the fallback in one chunk.
 */
async function* streamAnalysis({ session, user, system, recentSessions, mindState, goals }) {
  if (!llm.available()) {
    yield buildFallback(session, i18n.normalize(user && user.preferredLang), { system, recentSessions, mindState, goals });
    return;
  }
  const prep = prepareAnalysis({ session, user, system, recentSessions, mindState, goals });
  yield* llm.streamLLM(prep.systemPrompt, prep.content || prep.messageContent, { maxTokens: 900 });
}

/**
 * The weekly letter (spec §4.2) — the coach's short summary of the week.
 * Same contract as session analysis: NEVER a score line, no performance
 * claims, no integrity mechanics (rule 9). MindState context is the psych
 * integration: the letter may acknowledge what the trader has been working
 * on — in their own interest, privately.
 */
function buildWeeklyLetterPrompt({ user, system, weekSessions, movement, mindState }) {
  const stats = require('./weekly').weekStats(weekSessions);
  const dimLines = DIMENSION_ORDER.map(k => {
    const d = movement && movement.dimensions[k];
    if (!d) return null;
    const delta = d.delta == null ? 'building' : (d.delta > 0 ? `+${d.delta}` : String(d.delta));
    return `${k}: now ${d.now != null ? d.now : 'building'} (${delta} vs pre-week)`;
  }).filter(Boolean).join('\n');

  const themes = mindState && mindState.themes && mindState.themes.length
    ? mindState.themes.filter(t => t.status !== 'resolved').slice(0, 3).map(t =>
        `- ${t.name} [${t.status}]${t.note ? ` — ${t.note}` : ''}`).join('\n')
    : '';

  const sessionsLines = (weekSessions || []).slice(0, 10).map(s =>
    `- ${s.asset || '?'} (${s.sessionType || 'LIVE'}, ${s.outcome || '?'}, ${s.state}, ${s.ruleCompliance === true ? 'inside rules' : s.ruleCompliance === false ? 'broke rules' : 'rules not recorded'})`
  ).join('\n');

  return `You are KAIZEN (改), writing the weekly letter for ${user.username}. This is a private letter about their week of trading practice. It is read on one page, on a phone, with a cup of coffee.

HARD RULES:
- NEVER include a score line, percentage-as-judgment, or rank. Movement facts may be referenced plainly ("risk held steady"), but this letter is words, not numbers.
- No profit promises, no performance claims. Practice consistency is never trading performance.
- One page. Four short sections max. Warm, direct, zero flattery.
- LANGUAGE: always write the letter in English.
- VOICE: the letter speaks TO them — "your week", "your execution", "you held". Never third person ("the trader"), never bare noun phrases where possession matters ("execution held" → "your execution held").

THE WEEK:
Sessions: ${stats.total} (${stats.byType.LIVE} live, ${stats.byType.BACKTEST} backtest, ${stats.byType.STUDY} study)
Loop: ${stats.loopCompleted} fully analyzed, ${stats.loopOpen} still open
Inside rules: ${stats.complianceRate == null ? 'not recorded this week' : stats.compliant + ' of ' + stats.checked}
Dimension movement (background — reference at most one, in words):
${dimLines || 'no computed movement yet'}
Sessions this week:
${sessionsLines || 'none'}
${themes ? `What they have been working on psychologically (from private conversations — acknowledge only if the week's sessions reflect it, and gently):\n${themes}` : ''}
${system && system.name ? `Their system: "${system.name}" (v${system.version}).` : ''}

WRITE THE LETTER with exactly these sections, no headers needed:
1. Two-three sentences: the week in plain words.
2. The strongest moment — something specific they did.
3. The one pattern most worth attention next week — direct, not harsh.
4. One focus for next week, phrased as a process, not an outcome.`;
}

const DIMENSION_ORDER = ['process', 'risk', 'execution', 'behavior', 'learning'];

async function writeWeeklyLetter({ user, system, weekSessions, movement, mindState }) {
  if (llm.available()) {
    try {
      const raw = await llm.callLLM(
        buildWeeklyLetterPrompt({ user, system, weekSessions, movement, mindState }),
        'Write this week\'s letter.',
        { maxTokens: 900 }
      );
      return raw.trim();
    } catch (err) {
      console.error('Weekly letter API error:', err.message);
      // fall through to deterministic
    }
  }
  return buildWeeklyFallback({ weekSessions, movement, mindState, lang: i18n.normalize(user && user.preferredLang) });
}

/** Deterministic weekly letter (no API key) — honest, specific, never scored. */
function buildWeeklyFallback({ weekSessions, movement, mindState, lang = 'en' }) {
  const tr = (k, p) => i18n.t(lang, k, p);
  const stats = require('./weekly').weekStats(weekSessions);
  const parts = [];

  parts.push(tr('coach.wk.week', {
    total: stats.total, s: stats.total === 1 ? '' : 's',
    live: stats.byType.LIVE, backtest: stats.byType.BACKTEST, study: stats.byType.STUDY,
    done: stats.loopCompleted,
    open: stats.loopOpen ? tr('coach.wk.openNote', { open: stats.loopOpen }) : ''
  }));

  if (stats.complianceRate != null) {
    parts.push(stats.compliant === stats.checked
      ? tr('coach.wk.allIn')
      : tr('coach.wk.someIn', { compliant: stats.compliant, checked: stats.checked }));
  }

  const activeTheme = mindState && mindState.themes &&
    mindState.themes.find(t => t.status === 'active');
  if (activeTheme) {
    parts.push(tr('coach.wk.theme', { theme: activeTheme.name.toLowerCase() }));
  }

  const focusDim = movement && movement.dimensions &&
    ['risk', 'process', 'execution', 'behavior', 'learning'].find(k => movement.dimensions[k].delta != null && movement.dimensions[k].delta < 0);
  parts.push(focusDim
    ? (focusDim === 'learning' ? tr('coach.wk.focusLearning') : tr('coach.wk.focusDim', { dim: focusDim }))
    : tr('coach.wk.focus'));

  return parts.join('\n\n');
}

module.exports = {
  analyzeSession,
  streamAnalysis,
  parseExtracted,
  stripExtracted,
  buildFallback,
  buildSystemPrompt,
  interpretJournal,
  buildSessionReview,
  parseSessionReview,
  writeWeeklyLetter,
  buildWeeklyFallback
};
