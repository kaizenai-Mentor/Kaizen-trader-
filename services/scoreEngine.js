/**
 * KAIZEN Score Engine — V2 (config/App.js B6, B6b; config/AppCopy.js §5)
 *
 * THE CONTRACT:
 * - Deterministic: same inputs → same output. The AI explains these
 *   numbers; it NEVER generates them (V1's fatal flaw, retired).
 * - Complex internally, simple externally: the trader sees five
 *   dimensions and plain-language reasons.
 * - Honest: "building baseline" instead of fake numbers; extracted
 *   V1 evidence is tagged, weighted below declared data, and shown as
 *   "partially estimated." High compliance is NEVER a flag — a perfect
 *   streak is the Maintaining state, fully scoreable.
 * - Anti-gaming: single actions never move dimensions meaningfully;
 *   integrity guards (cadence, novelty, low-signal) shape evidence,
 *   never delete it.
 *
 * Pure function — no DB, no AI, no clock reads (pass `now`).
 */

const FORMULA_VERSION = '2.0.0';

const WEIGHTS = { process: 0.25, risk: 0.25, execution: 0.2, behavior: 0.15, learning: 0.15 };

// Minimum declared evidence before a dimension is READY (B6 states).
const THRESHOLDS = { process: 5, risk: 5, execution: 5, behavior: 10, learning: 5 };

// Extracted evidence is real but worth less than declared data.
const EXTRACTED_WEIGHT = 0.6;

const NOT_MENTIONED = 'NOT_MENTIONED';
const REFLECTED_PLUS = ['REFLECTED', 'ANALYZED'];

function pct(n) { return Math.round(n); }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/**
 * Weighted yes/no ratio. Each observation carries a weight
 * (declared = 1.0, extracted = 0.6). Untouched ("NOT_MENTIONED") rows
 * never count for or against — silence is silence.
 */
function weightedRatio(observations) {
  let yes = 0, no = 0;
  for (const o of observations) {
    if (o.yes === true) yes += o.weight;
    else if (o.yes === false) no += o.weight;
  }
  const total = yes + no;
  if (total === 0) return null;
  return yes / total;
}

function isPersistedSession(s) {
  return Boolean(s && (s._id || typeof s.ruleCompliance === 'boolean'));
}

function getEffectiveChecks(s) {
  const q = (s && s.quickChecks) || {};
  let followedPlan = q.followedPlan || NOT_MENTIONED;
  let withinEntryCriteria = q.withinEntryCriteria || NOT_MENTIONED;
  let respectedRisk = q.respectedRisk || NOT_MENTIONED;

  // For real persisted DB sessions (which carry _id / boolean ruleCompliance)
  // that have been recorded (not still in PLANNED state), infer any untouched
  // quick checks from the trader's written notes and ruleCompliance so logging
  // a session without clicking the optional radio buttons still scores properly.
  if (isPersistedSession(s) && s.state !== 'PLANNED') {
    const notes = String(s.notes || '');
    const hasNotesOrCompliance = Boolean(notes.trim()) || typeof s.ruleCompliance === 'boolean';
    if (hasNotesOrCompliance) {
      const compliant = s.ruleCompliance !== false;
      const brokePlanText = /\b(broke|ignored|violated)\s+(my\s+)?(plan|rules|entry|system)|entered\s+without\s+(my\s+)?(setup|confirmation|trigger)\b/i.test(notes);
      const brokeExecText = /\b(moved?\s+(my\s+)?(stop|sl|invalidation)|widened?\s+(my\s+)?stop|chased|chasing|entered\s+early|jumped\s+in)\b/i.test(notes);
      const brokeRiskText = /\b((doubled|increased|added\s+to)\s+(my\s+)?(position|risk)|oversized|too\s+big\s+a\s+size|blew|exceeded\s+risk)\b/i.test(notes);

      if (followedPlan === NOT_MENTIONED) {
        if (s.plan && s.plan.skipped) followedPlan = 'NO_PLAN';
        else followedPlan = (!compliant || brokePlanText) ? 'NO' : 'YES';
      }
      if (withinEntryCriteria === NOT_MENTIONED) {
        if (s.plan && s.plan.skipped) withinEntryCriteria = NOT_MENTIONED;
        else withinEntryCriteria = (!compliant || brokeExecText) ? 'NO' : 'YES';
      }
      if (respectedRisk === NOT_MENTIONED) {
        respectedRisk = (brokeRiskText || (!compliant && /risk|size|stop|sl|drawdown/i.test(notes + ' ' + ((s.violations || []).join(' ')))))
          ? 'NO'
          : 'YES';
      }
    }
  }

  return { followedPlan, withinEntryCriteria, respectedRisk };
}

function isV2Session(s) {
  return !!s.plan || !!s.quickChecks || !!s.reflection ||
    isPersistedSession(s) ||
    REFLECTED_PLUS.includes(s.state) || s.state === 'PLANNED';
}

function hasReflection(s) {
  const r = s.reflection;
  if (r) {
    const chars = [r.whatHappened, r.followedProcess, r.learned, r.wouldChange]
      .filter(Boolean).join('').trim().length;
    if (chars >= 20) return true;
  }
  // Persisted recorded sessions with substantive written journal notes also count
  if (isPersistedSession(s) && s.state !== 'PLANNED') {
    const noteChars = String(s.notes || '').trim().length;
    if (noteChars >= 20) return true;
  }
  return false;
}

function reflectionSubstance(s) {
  const r = s.reflection;
  const reflChars = r
    ? [r.whatHappened, r.followedProcess, r.learned, r.wouldChange]
        .filter(Boolean).join('').trim().length
    : 0;
  const noteChars = isPersistedSession(s) ? String(s.notes || '').trim().length : 0;
  const chars = Math.max(reflChars, Math.round(noteChars * 0.8));
  if (chars <= 0) return 0;
  // Diminishing curve: 40 chars → ~0.45, 150 → ~0.8, 400+ → ~1
  return chars / (chars + 90);
}

function blendWithExtracted(v2Score, v2Count, threshold, ex) {
  if (!ex || !ex.count || ex.rate === null || ex.rate === undefined) return v2Score;
  const base = partialScore(ex.rate);
  const v2Share = clamp((v2Count / Math.max(threshold, 1)) * 0.75 + 0.2, 0.25, 0.92);
  return pct(clamp(v2Share * v2Score + (1 - v2Share) * base, 0, 100));
}

function dayKey(d) { return Math.floor(new Date(d).getTime() / 86400000); }

function parseNum(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * @param {Array}    sessions  V2 Session docs (plain objects fine), any order.
 * @param {object}   system    TradingSystem (or null) — riskRules.maxDailyTrades used.
 * @param {object}   extracted Aggregated V1 extraction rates (or null):
 *                   { process:{rate,count}, risk:{...}, execution:{...},
 *                     behavior:{...}, learning:{...} } — rates are 0..1.
 * @param {Date}     now       Clock injection for reproducibility.
 * @returns {object} Snapshot-shaped result (see models/ScoreSnapshot.js).
 */
function computeScore(sessions = [], system = null, extracted = null, now = new Date()) {
  const all = [...sessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const v2 = all.filter(isV2Session);
  const recent = v2.slice(-20); // short window (10–20 sessions, frozen)

  const dims = {
    process: computeProcess(recent, extracted && extracted.process),
    risk: computeRisk(recent, system, extracted && extracted.risk),
    execution: computeExecution(recent, extracted && extracted.execution),
    behavior: computeBehavior(recent, extracted && extracted.behavior),
    learning: computeLearning(recent, extracted && extracted.learning)
  };

  const readyDims = Object.keys(dims).filter(k => dims[k].state === 'READY');
  const partialDims = Object.keys(dims).filter(k => dims[k].state === 'PARTIAL');

  let overall = null;
  let overallState = 'BUILDING';
  const scoreable = readyDims.concat(partialDims);
  if (scoreable.length > 0) {
    let wSum = 0, acc = 0;
    for (const k of scoreable) {
      acc += WEIGHTS[k] * dims[k].score;
      wSum += WEIGHTS[k];
    }
    overall = pct(acc / wSum);
    overallState = readyDims.length >= 3 ? 'READY' : 'PARTIAL';
  }

  const declared = v2.filter(s => s.quickChecks && (
    s.quickChecks.followedPlan !== NOT_MENTIONED ||
    s.quickChecks.withinEntryCriteria !== NOT_MENTIONED ||
    s.quickChecks.respectedRisk !== NOT_MENTIONED)).length;

  return {
    formulaVersion: FORMULA_VERSION,
    overall,
    overallState,
    dimensions: dims,
    evidenceMix: {
      declared,
      extracted: extracted ? Object.values(extracted).reduce((a, e) => a + ((e && e.count) || 0), 0) : 0
    },
    sessionsConsidered: v2.length
  };
}

// ── PROCESS ──────────────────────────────────────────────────────
// "Do you follow your own system?" — planning is the declaration;
// adherence is honored only among planned sessions. An honest skip
// ("Skip — trade without a plan") counts with partial credit: reduced
// evidence, never a punishment.
function computeProcess(recent, ex) {
  const planned = recent.filter(s => (s.plan && !s.plan.skipped) || (isPersistedSession(s) && !(s.plan && s.plan.skipped)));
  const skipped = recent.filter(s => s.plan && s.plan.skipped);
  const n = recent.length;

  const declaredYesNo = planned
    .map(s => ({ s, q: getEffectiveChecks(s) }))
    .filter(({ q }) => ['YES', 'NO'].includes(q.followedPlan))
    .map(({ q }) => ({ yes: q.followedPlan === 'YES', weight: 1 }));
  const adherence = weightedRatio(declaredYesNo);

  if (planned.length >= 1 && adherence !== null) {
    const planRate = (planned.length + 0.35 * skipped.length) / Math.max(n, 1);
    const v2Score = pct(100 * (0.55 * clamp(planRate, 0, 1) + 0.45 * adherence));
    const yes = declaredYesNo.filter(o => o.yes).length;
    if (planned.length >= THRESHOLDS.process && declaredYesNo.length >= THRESHOLDS.process) {
      return {
        score: v2Score,
        state: 'READY',
        reasons: [
          `Planned ${planned.length} of your last ${n} sessions.`,
          `Followed your plan in ${yes} of ${declaredYesNo.length} planned sessions.`
        ]
      };
    }
    const blended = blendWithExtracted(v2Score, declaredYesNo.length, THRESHOLDS.process, ex);
    return {
      score: blended,
      state: 'PARTIAL',
      reasons: [
        `Planned ${planned.length} of your last ${n} sessions (${yes} of ${declaredYesNo.length} followed).`,
        ex && ex.count ? `Blended with ${ex.count} earlier sessions while building toward ${THRESHOLDS.process} V2 sessions.` : `Active score from ${declaredYesNo.length} of ${THRESHOLDS.process} sessions needed for full baseline.`
      ]
    };
  }

  if (ex && ex.count >= THRESHOLDS.process) {
    return {
      score: partialScore(ex.rate),
      state: 'PARTIAL',
      reasons: [
        `Partially estimated from your written history (${ex.count} sessions).`,
        'Log planned sessions to make this dimension fully yours.'
      ]
    };
  }

  return {
    score: null,
    state: 'BUILDING',
    reasons: [`Building baseline — ${planned.length} of ${THRESHOLDS.process} planned sessions.`]
  };
}

// ── RISK ─────────────────────────────────────────────────────────
// "Do you protect yourself from unnecessary losses?" — respected-risk
// ratio plus the cadence guard: sessions beyond the system's
// maxDailyTrades are marked and count as overtrading evidence in
// Behavior; here they lightly damp Risk too (the farmer's extra
// entries are never free).
function computeRisk(recent, system, ex) {
  const declaredYesNo = recent
    .map(s => ({ s, q: getEffectiveChecks(s) }))
    .filter(({ q }) => ['YES', 'NO'].includes(q.respectedRisk))
    .map(({ q }) => ({ yes: q.respectedRisk === 'YES', weight: 1 }));
  const respected = weightedRatio(declaredYesNo);

  const maxPerDay = system && parseNum(system.riskRules && system.riskRules.maxDailyTrades);
  let cadenceBreaks = 0;
  if (maxPerDay && maxPerDay > 0) {
    const perDay = {};
    for (const s of recent) {
      if (s.sessionType === 'STUDY') continue;
      const k = dayKey(s.createdAt);
      perDay[k] = (perDay[k] || 0) + 1;
      if (perDay[k] > maxPerDay) {
        cadenceBreaks++;
        if (s.evidenceFlags) s.evidenceFlags.beyondCadence = true;
      }
    }
  }

  if (declaredYesNo.length >= 1 && respected !== null) {
    const yes = declaredYesNo.filter(o => o.yes).length;
    const v2Score = pct(clamp(100 * respected - 4 * cadenceBreaks, 0, 100));
    const reasons = [
      `Respected your risk in ${yes} of ${declaredYesNo.length} checked sessions.`
    ];
    if (cadenceBreaks > 0) {
      reasons.push(`${cadenceBreaks} session${cadenceBreaks > 1 ? 's' : ''} beyond your system's daily trade limit — the excess is the data.`);
    }
    if (declaredYesNo.length >= THRESHOLDS.risk) {
      return { score: v2Score, state: 'READY', reasons };
    }
    const blended = blendWithExtracted(v2Score, declaredYesNo.length, THRESHOLDS.risk, ex);
    return { score: blended, state: 'PARTIAL', reasons };
  }

  if (ex && ex.count >= THRESHOLDS.risk) {
    return {
      score: partialScore(ex.rate),
      state: 'PARTIAL',
      reasons: [`Partially estimated from your written history (${ex.count} sessions).`]
    };
  }

  return {
    score: null,
    state: 'BUILDING',
    reasons: [`Building baseline — ${declaredYesNo.length} of ${THRESHOLDS.risk} risk-checked sessions.`]
  };
}

// ── EXECUTION ────────────────────────────────────────────────────
// "Do your trades match your plan?" — only answerable among planned
// sessions (the plan is the reference). No plan → no execution
// evidence (goes to Process, not here).
function computeExecution(recent, ex) {
  const planned = recent.filter(s => (s.plan && !s.plan.skipped) || (isPersistedSession(s) && !(s.plan && s.plan.skipped)));
  const declaredYesNo = planned
    .map(s => ({ s, q: getEffectiveChecks(s) }))
    .filter(({ q }) => ['YES', 'NO'].includes(q.withinEntryCriteria))
    .map(({ q }) => ({ yes: q.withinEntryCriteria === 'YES', weight: 1 }));
  const within = weightedRatio(declaredYesNo);

  if (declaredYesNo.length >= 1 && within !== null) {
    const yes = declaredYesNo.filter(o => o.yes).length;
    const v2Score = pct(100 * within);
    const reasons = [
      `Entered within your criteria in ${yes} of ${declaredYesNo.length} planned sessions.`
    ];
    if (declaredYesNo.length >= THRESHOLDS.execution) {
      return {
        score: v2Score,
        state: 'READY',
        reasons
      };
    }
    const blended = blendWithExtracted(v2Score, declaredYesNo.length, THRESHOLDS.execution, ex);
    return {
      score: blended,
      state: 'PARTIAL',
      reasons
    };
  }

  if (ex && ex.count >= THRESHOLDS.execution) {
    return {
      score: partialScore(ex.rate),
      state: 'PARTIAL',
      reasons: [`Partially estimated from your written history (${ex.count} sessions).`]
    };
  }

  return {
    score: null,
    state: 'BUILDING',
    reasons: [`Building baseline — ${declaredYesNo.length} of ${THRESHOLDS.execution} planned, checked sessions.`]
  };
}

// ── BEHAVIOR ─────────────────────────────────────────────────────
// "What does your psychology make you do?" — DECLARED emotional
// states (the plan chips the trader ticks before the session), the
// after-loss window where discipline usually breaks, and cadence
// violations from the Risk pass (B6b: the farming attempt IS the
// data). Free-text emotion words are deliberately NOT read here:
// "felt FOMO but waited for my setup" is disciplined honesty, and
// honest disclosure must never count against a trader (owner rule:
// high compliance is never a flag).
const NEGATIVE_EMOTIONS = ['FOMO', 'REVENGE', 'ANXIOUS'];
function computeBehavior(recent, ex) {
  if (recent.length >= 1) {
    let negatives = 0;
    let afterLoss = 0, afterLossViolations = 0;

    for (let i = 0; i < recent.length; i++) {
      const s = recent[i];
      const q = getEffectiveChecks(s);
      const emotion = (s.plan && s.plan.emotionalState) || s.emotion || '';
      const negEmotion = NEGATIVE_EMOTIONS.includes(String(emotion).toUpperCase());
      if (negEmotion) negatives++;

      if (s.evidenceFlags && s.evidenceFlags.beyondCadence) negatives++;

      const prev = recent[i - 1];
      if (prev && prev.outcome === 'Loss') {
        afterLoss++;
        const brokePlan = q.followedPlan === 'NO' || q.withinEntryCriteria === 'NO';
        if (brokePlan) afterLossViolations++;
      }
    }

    const negRate = negatives / recent.length;
    const afterLossRate = afterLoss > 0 ? afterLossViolations / afterLoss : null;
    let score = 100 * (1 - 0.7 * negRate);
    if (afterLossRate !== null) score -= 15 * afterLossRate;
    const v2Score = pct(clamp(score, 0, 100));

    const reasons = [];
    if (afterLoss > 0 && afterLossViolations > 0) {
      reasons.push(`After a loss, you broke plan in ${afterLossViolations} of ${afterLoss} sessions — the window KAIZEN watches closest.`);
    }
    if (negatives > 0) {
      reasons.push(`${negatives} of your last ${recent.length} sessions carried emotional pressure signals.`);
    }
    if (reasons.length === 0) {
      reasons.push('No emotional red flags in your recent sessions. Keep protecting that calm.');
    }
    if (recent.length >= THRESHOLDS.behavior) {
      return { score: v2Score, state: 'READY', reasons };
    }
    const blended = blendWithExtracted(v2Score, recent.length, THRESHOLDS.behavior, ex);
    return { score: blended, state: 'PARTIAL', reasons };
  }

  if (ex && ex.count >= THRESHOLDS.behavior) {
    // ex.rate is a POSITIVE rate (calm sessions share) from extraction
    return {
      score: partialScore(ex.rate),
      state: 'PARTIAL',
      reasons: [`Partially estimated from your written history (${ex.count} sessions).`]
    };
  }

  return {
    score: null,
    state: 'BUILDING',
    reasons: [`Building baseline — ${recent.length} of ${THRESHOLDS.behavior} sessions.`]
  };
}

// ── LEARNING & CONSISTENCY ───────────────────────────────────────
// "Are you becoming better?" — three states (B6b, recalibrated):
// Correcting (violation → later compliance), Practicing (reflections +
// system versions), Maintaining (sustained high adherence). A perfect
// streak is the Maintaining state — a GOOD state, fully scoreable.
// Duplicate-flagged sessions earn zero reflection credit (novelty
// guard). Nobody is ever required to make mistakes.
function computeLearning(recent, ex) {
  const reflected = recent.filter(s => hasReflection(s) &&
    !(s.evidenceFlags && s.evidenceFlags.duplicateOf));
  const withPlan = recent.filter(s => (s.plan && !s.plan.skipped) || (isPersistedSession(s) && !(s.plan && s.plan.skipped)));

  if (reflected.length >= 1) {
    const reflectionRate = reflected.length / Math.max(recent.length, 1);

    // Practicing: substance of what's written
    const substance = reflected.reduce((a, s) => a + reflectionSubstance(s), 0) / reflected.length;

    // Correcting: violations followed within 3 sessions by compliance
    let corrections = 0, violations = 0;
    for (let i = 0; i < recent.length; i++) {
      const s = recent[i];
      const q = getEffectiveChecks(s);
      const violated = q.followedPlan === 'NO' || q.withinEntryCriteria === 'NO';
      if (!violated) continue;
      violations++;
      const window = recent.slice(i + 1, i + 4);
      if (window.some(w => getEffectiveChecks(w).followedPlan === 'YES')) corrections++;
    }
    const correctionRate = violations > 0 ? corrections / violations : null;

    // Maintaining: ≥90% plan adherence across the whole recent window
    const plannedChecks = withPlan
      .map(s => ({ s, q: getEffectiveChecks(s) }))
      .filter(({ q }) => ['YES', 'NO'].includes(q.followedPlan));
    const adherence = plannedChecks.length > 0
      ? plannedChecks.filter(({ q }) => q.followedPlan === 'YES').length / plannedChecks.length
      : null;
    const maintaining = adherence !== null && adherence >= 0.9;

    let score = 100 * (0.4 * reflectionRate + 0.3 * substance);
    score += 100 * (correctionRate !== null ? 0.3 * correctionRate : 0.3 * (maintaining ? 1 : 0.4));
    const v2Score = pct(clamp(score, 0, 100));

    const reasons = [];
    if (maintaining) reasons.push(`Maintaining — ${Math.round(adherence * 100)}% plan adherence across your recent sessions. That is the skill itself.`);
    if (corrections > 0) reasons.push(`Corrected a breakdown within three sessions, ${corrections} time${corrections > 1 ? 's' : ''}.`);
    if (reasons.length === 0) reasons.push(`Reflected on ${reflected.length} of your last ${recent.length} sessions.`);

    if (reflected.length >= THRESHOLDS.learning) {
      return { score: v2Score, state: 'READY', reasons };
    }
    const blended = blendWithExtracted(v2Score, reflected.length, THRESHOLDS.learning, ex);
    return { score: blended, state: 'PARTIAL', reasons };
  }

  if (ex && ex.count >= THRESHOLDS.learning) {
    return {
      score: partialScore(ex.rate),
      state: 'PARTIAL',
      reasons: [`Partially estimated from your written history (${ex.count} sessions).`]
    };
  }

  return {
    score: null,
    state: 'BUILDING',
    reasons: [`Building baseline — ${reflected.length} of ${THRESHOLDS.learning} reflected sessions.`]
  };
}

// Extracted evidence is dampened toward neutral — real, but never
// granted the precision of declared data (B6 transition mechanics).
function partialScore(rate) {
  const r = (rate === null || rate === undefined) ? 0.5 : rate;
  return pct(clamp(50 + (r - 0.5) * 100 * EXTRACTED_WEIGHT, 0, 100));
}

module.exports = {
  computeScore,
  FORMULA_VERSION,
  WEIGHTS,
  THRESHOLDS,
  // exported for tests
  _internals: { weightedRatio, partialScore, isV2Session, parseNum }
};
