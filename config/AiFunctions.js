/**
 * config/AiFunctions.js — THE AI FUNCTION SPEC (owner directive,
 * 18 Sep 2026). What the AI layer does, what it never does, and where
 * each function lives in the code today.
 *
 * THE KAIZEN LOOP (frozen — this is the only allowed architecture):
 *
 *   Trader activity
 *     → Structured data
 *       → KAIZEN deterministic scoring engine (five canonical dimensions)
 *         → Behavior / pattern engine
 *           → AI interpretation
 *             → Personalized coaching
 *               → Trader improves
 *                 → New data
 *                   → Score changes
 *
 * NEVER BUILT: AI → Score. The engine measures; the AI explains.
 * (Frozen since the V2 reset; identical to the whitepaper's public
 * statement and config/App.js B6/B6b.)
 *
 * THE ANTI-GAMING RULE (owner, 18 Sep 2026 — enforced in the prompts):
 * The AI is never allowed to tell a trader they are "disciplined"
 * because they wrote a convincing journal entry. Conclusions about
 * discipline or improvement must rest on measured behavior — quick
 * checks, rule compliance, engine facts. Polished prose is never
 * evidence. This is what makes KAIZEN hard to game: the words respond
 * to the record; the record does not respond to the words.
 *
 * ============================================================================
 * THE TEN FUNCTIONS — status as of 18 Sep 2026
 * ============================================================================
 *
 * 1. TRADER PATTERN DETECTION — identify recurring behaviors from history.
 *    Examples: entering before confirmation, moving stops, overtrading after
 *    losses, trading outside planned hours, raising risk after a loss.
 *    STATUS: ENGINE CORE EXISTS.
 *      - services/scoreEngine.js: the after-loss window computes exact
 *        counts ("After a loss, you broke plan in X of Y sessions") and
 *        feeds the Behavior dimension; plan/record quick checks feed
 *        Execution; skipped-plan honesty rules apply.
 *      - Session analysis prompt carries "THE PATTERN KAIZEN IS TRACKING"
 *        (cross-session patterns only, never invented).
 *    GAP (later): a structured pattern catalog with named detectors
 *    (early entry, moved stop, out-of-hours, risk-up) surfaced as counts
 *    the AI may quote.
 *
 * 2. PERSONALIZED TRADING COACH — context-aware, never generic.
 *    STATUS: EXISTS. All three coaches (aiCoach, tradeCoach, psychCoach)
 *    receive the trader's actual Trading System, recent sessions
 *    (plan vs record), and their own written reflections. Deterministic
 *    fallbacks without any provider key stay honest — never generic
 *    fluff, always their real record.
 *
 * 3. TRADE / JOURNALING ANALYSIS — Plan → Execution → Result → Reflection.
 *    The AI explains what was done correctly, where execution deviated,
 *    whether the process was good independent of the win/loss, and what
 *    to watch next time.
 *    STATUS: EXISTS. This is the ANALYZE stage of the session loop
 *    (services/aiCoach.js analyzeSession / streamAnalysis), now streaming
 *    in place on the Reflect page.
 *
 * 4. WEEKLY / MONTHLY PERFORMANCE REVIEW — the period in honest numbers,
 *    then 2-3 priorities from the AI.
 *    STATUS: WEEKLY EXISTS. services/weekly.js (pure stats: sessions by
 *    type, loop completion, compliance rate) + the weekly letter
 *    (writeWeeklyLetter, deterministic fallback included) on the Weekly
 *    Report page. The letter's focus line is the "priorities" part.
 *    GAP (later): monthly roll-up; "most common violation" naming once
 *    the pattern catalog (function 1) exists.
 *
 * 5. SCORE EXPLANATION — engine calculates, AI explains. The distinction
 *    that makes KAIZEN credible.
 *    STATUS: PRINCIPLE FROZEN AND ENFORCED. The AI never produces or
 *    changes a number; prompts forbid score lines; tests guard the
 *    contract. The engine already emits human-readable reasons with each
 *    score (score.reasons — deterministic explanations).
 *    GAP (later): an AI surface that narrates WHY the score moved, using
 *    ScoreSnapshot history + engine reasons as its only sources.
 *
 * 6. PERSONALIZED DAILY BRIEF — "Today's focus" from actual history on
 *    login.
 *    STATUS: NOT BUILT. The Cockpit TODAY card shows loop actions only.
 *    Build later as: deterministic focus selection (from the same engine
 *    facts) + one AI-written line. The focus must come from the record,
 *    not from whatever the trader last wrote.
 *
 * 7. TRADING PLAN ASSISTANT — help turn observations into structured
 *    rules; the trader owns and accepts every rule.
 *    STATUS: EXISTS (conversational). The KAIZEN AI chat anchors to their
 *    system, helps write missing rules ("Help me write my first entry
 *    rule" is a first-run opener), and quizzes them on their own rules.
 *    Rules are saved as versions in My Trading System — the AI never
 *    writes rules on the trader's behalf.
 *
 * 8. GOAL & IMPROVEMENT TRACKING — trader picks a goal (reduce
 *    overtrading, risk consistency, entry rules, journaling, fewer
 *    emotional decisions); KAIZEN tracks the relevant measured behavior
 *    over time and reports whether it is actually improving.
 *    STATUS: NOT BUILT. Needs a Goal model keyed to engine-measured
 *    behaviors (never self-reported feelings of improvement).
 *
 * 9. NATURAL-LANGUAGE "ASK KAIZEN" — "Why did my score drop this week?"
 *    "What is my biggest weakness right now?" answered from the user's
 *    own structured data.
 *    STATUS: PARTIAL. The KAIZEN AI chat exists and carries session +
 *    system digests. GAP (later): feed the chat the structured context it
 *    is missing — ScoreSnapshot history, dimension movement, engine
 *    reasons — so score questions are answered from data, not vibes.
 *
 * 10. OPPORTUNITY MATCHING — trader profile + behavior evidence →
 *     eligibility criteria → opportunity database (funding, competitions,
 *     bounties).
 *     STATUS: LOCKED OUT (docs/VISION.md). Owner agrees: much further
 *     down the roadmap. Not built, not designed around, no exceptions
 *     until the vision itself changes.
 *
 * ============================================================================
 * BUILD ORDER FOR THE GAPS (proposed, awaiting owner approval — post-merge)
 * ============================================================================
 * 1. Score explanation surface (function 5) — data already exists
 *    (ScoreSnapshots + engine reasons); highest credibility value.
 * 2. Daily brief (function 6) — small, deterministic core + one AI line.
 * 3. Ask-KAIZEN structured context (function 9) — extends the existing
 *    chat with score history digests.
 * 4. Pattern catalog (functions 1+4) — named detectors as engine outputs.
 * 5. Goal tracking (function 8) — new model, keyed to measured behaviors.
 * Monthly review rides along with 4. Function 10 stays locked.
 */
