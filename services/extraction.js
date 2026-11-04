/**
 * V1 Evidence Extraction — one-time, deterministic (config/App.js B6
 * transition mechanics, owner 13–14 Sep 2026).
 *
 * Reads each legacy journal entry ONCE and pulls out only explicitly
 * stated facts. Silence is "unknown" — never counted for or against.
 * Every extracted fact is tagged and weighted below declared data.
 *
 * Deterministic by design (regex/heuristics — the same code the V1
 * predictive warning already used for FOMO/revenge detection). An
 * optional AI-assisted pass may enrich this later; it can never
 * replace it, and the one-time snapshot guard (entries cannot be
 * edited today; there is no edit route) keeps the extraction safe
 * from retroactive gaming.
 */

const EMOTION_NEG = /fomo|revenge|frustrat|angry|tilt|chasing/i;
const MOVED_STOP = /moved?\s+(my\s+)?(stop|sl|invalidation)|\bsl\s+to\s+be\b|widened?\s+(my\s+)?stop/i;
const HELD_STOP = /held?\s+(my\s+)?(stop|sl|invalidation)|respected?\s+(my\s+)?stop|left\s+my\s+stop/i;
const RISK_OK = /risked?\s*[0-9.]+\s*%|sized\s+(in\s+)?(properly|correctly)|proper\s?(position\s)?size|1\s?%\s*risk/i;
const RISK_BAD = /(doubled|increased|added\s+to)\s+(my\s+)?(position|risk)|oversized|too\s+big\s+a\s+size/i;
const FOLLOWED_PLAN = /followed?\s+(my\s+)?(plan|rules|system)|stuck\s+to\s+(my\s+)?(plan|rules)/i;
const BROKE_PLAN = /(broke|broke|ignored|violated)\s+(my\s+)?(plan|rules|entry)|entered?\s+without\s+(my\s+)?(setup|confirmation|trigger)/i;

/**
 * Extract structured facts from one legacy journal's freeform notes.
 * @returns {{facts: Array<{dimension:string, kind:string, yes:boolean|null}>}}
 */
function extractFacts(journal) {
  const text = (journal && journal.notes) || '';
  const facts = [];

  if (MOVED_STOP.test(text)) facts.push({ dimension: 'execution', kind: 'withinCriteria', yes: false });
  else if (HELD_STOP.test(text)) facts.push({ dimension: 'execution', kind: 'withinCriteria', yes: true });

  if (RISK_OK.test(text)) facts.push({ dimension: 'risk', kind: 'respected', yes: true });
  if (RISK_BAD.test(text)) facts.push({ dimension: 'risk', kind: 'respected', yes: false });

  if (FOLLOWED_PLAN.test(text)) facts.push({ dimension: 'process', kind: 'adherence', yes: true });
  else if (BROKE_PLAN.test(text)) facts.push({ dimension: 'process', kind: 'adherence', yes: false });

  // Behavior: a negative-emotion mention marks the session (calm = absence of signal)
  const behaviorSignal = EMOTION_NEG.test(text);
  if (behaviorSignal) facts.push({ dimension: 'behavior', kind: 'negativeSignal', yes: false });

  return { facts };
}

/**
 * Aggregate extracted facts into the per-dimension rates the Score
 * Engine consumes. Sessions with zero facts still count toward the
 * behavior denominator (calm sessions are data), and toward learning
 * (a legacy entry is weak reflection evidence).
 *
 * @param {Array} journals legacy Journal docs (notes required).
 * @returns {object|null} extracted input for computeScore, or null when
 *                        there is nothing usable.
 */
function aggregateExtraction(journals) {
  if (!journals || journals.length === 0) return null;

  const buckets = {
    process: { yes: 0, no: 0 },
    risk: { yes: 0, no: 0 },
    execution: { yes: 0, no: 0 },
    behavior: { yes: 0, no: 0 },
    learning: { yes: 0, no: 0 }
  };

  for (const j of journals) {
    const { facts } = extractFacts(j);
    for (const f of facts) {
      if (f.yes === true) buckets[f.dimension].yes++;
      else if (f.yes === false) buckets[f.dimension].no++;
    }
    // Every legacy session counts as calm-behavior evidence unless flagged
    if (!facts.some(f => f.dimension === 'behavior')) buckets.behavior.yes++;
    // Every legacy session counts as weak reflection evidence
    buckets.learning.yes += 0.5;
  }

  const out = {};
  for (const dim of Object.keys(buckets)) {
    const b = buckets[dim];
    const count = b.yes + b.no;
    out[dim] = count > 0 ? { rate: b.yes / count, count: journals.length } : { rate: null, count: 0 };
  }
  // If legacy journals come from MongoDB with boolean ruleCompliance and
  // freeform notes did not trigger explicit regexes for process/risk/execution,
  // use ruleCompliance as fallback evidence so legacy history is never lost.
  const anyExplicit = ['process', 'risk', 'execution'].some(d => buckets[d].yes + buckets[d].no > 0);
  const withCompliance = journals.filter(j => j && typeof j.ruleCompliance === 'boolean');
  if (!anyExplicit && withCompliance.length > 0) {
    const compRate = withCompliance.filter(j => j.ruleCompliance === true).length / withCompliance.length;
    out.process = { rate: compRate, count: withCompliance.length };
    out.risk = { rate: compRate, count: withCompliance.length };
    out.execution = { rate: compRate, count: withCompliance.length };
    return out;
  }
  if (!anyExplicit) {
    return { process: null, risk: null, execution: null, behavior: out.behavior, learning: out.learning };
  }
  return out;
}

/**
 * One-time runner: extracts evidence for a user's legacy journals and
 * stamps them. Also repairs user.v1Evidence if v1ExtractedAt was set
 * previously without persisting user.v1Evidence.
 * @returns {object|null} the aggregated extraction (to persist on User
 *                        and ScoreSnapshot), or null.
 */
async function runV1Extraction(user, Journal) {
  if (!user) return null;
  const hasSavedEvidence = user.v1Evidence && (
    (user.v1Evidence.process && user.v1Evidence.process.count > 0) ||
    (user.v1Evidence.behavior && user.v1Evidence.behavior.count > 0)
  );
  if (user.v1ExtractedAt && hasSavedEvidence) return user.v1Evidence;

  const cutoff = user.v1CutoverAt || new Date();
  const allUserJournals = await Journal.find({
    userId: user._id,
    createdAt: { $lte: cutoff }
  }).lean();

  // Legacy entries are those without a populated V2 plan setup and without explicit V2 YES/NO quickChecks
  const legacy = allUserJournals.filter(j => {
    const hasV2Plan = j.plan && (j.plan.setup || j.plan.entryCondition || j.plan.invalidation || j.plan.skipped === true);
    const hasV2Checks = j.quickChecks && (
      ['YES', 'NO'].includes(j.quickChecks.followedPlan) ||
      ['YES', 'NO'].includes(j.quickChecks.withinEntryCriteria) ||
      ['YES', 'NO'].includes(j.quickChecks.respectedRisk)
    );
    return !hasV2Plan && !hasV2Checks;
  });

  if (!legacy.length) {
    user.v1ExtractedAt = user.v1ExtractedAt || new Date();
    await user.save();
    return null;
  }

  const agg = aggregateExtraction(legacy);

  // Stamp each legacy doc with its extracted tag (evidence trail, one-time)
  for (const j of legacy) {
    const f = extractFacts(j).facts.map(x => ({ dimension: x.dimension, kind: x.kind, yes: x.yes }));
    if (f.length) {
      await Journal.updateOne({ _id: j._id }, { $set: { 'evidenceFlags.extracted': { facts: f, at: new Date() } } });
    }
  }

  user.v1Evidence = agg;
  user.v1ExtractedAt = user.v1ExtractedAt || new Date();
  await user.save();
  return agg;
}

module.exports = { extractFacts, aggregateExtraction, runV1Extraction };
