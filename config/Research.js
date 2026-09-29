/**
 * config/Research.js — TRADER RESEARCH RECORD.
 *
 * Round 1: initial survey, recorded 29 Sep 2026. More responses are being
 * collected; this file is the living record, appended per round.
 *
 * SOURCE DATA (owner-uploaded to main, commit 4cf166d):
 *   - "KAIZEN TRADER RESEARCH SURVEY- Why do traders struggle to become
 *     consistently profitable- (Responses) (1).xlsx" — uploaded twice with
 *     slightly different names; files are identical, 5 responses, 24
 *     questions. Contains respondent emails (see PRIVACY NOTE).
 *   - "POINTS AND CONCLUSIONS FROM KAIZEN'S SURVEY .pdf" — the owner's
 *     20-page analysis.
 *
 * HONEST FRAME (owner's own wording, kept): five respondents is an early
 * sample, not a statistically representative study. Themes below are
 * hypotheses that more responses must confirm or kill. Nothing here
 * overrides a locked decision (VISION, structural signals, anti-gaming);
 * it informs priority, copy, and the next build order.
 *
 * ============================================================================
 * ROUND 1 — FINDINGS (verified against the raw data, not just the PDF)
 * ============================================================================
 * Respondents are referenced as R1–R5 (timestamp order). Emails are NOT
 * copied into this file.
 *
 * 1. THE KNOWING-DOING GAP IS CENTRAL. 5 of 5 break their own rules
 *    (Sometimes: R1, R3. Often: R2, R4, R5). Stated causes are emotional,
 *    not ignorance: fear 3, greed 3, excitement after a win 2, lack of a
 *    clear plan 2, FOMO 1, lack of confidence 1. This is the KAIZEN
 *    thesis in the target audience's own answers: they know the rules;
 *    the doing is what breaks.
 *    → VALIDATES: the core positioning, the hero line, the Behavior
 *      dimension, the Psychology space.
 *
 * 2. R3 IS THE MOST INSTRUCTIVE DATA POINT. Self-described "consistently
 *    profitable" scalper who nonetheless reports revenge trading, FOMO,
 *    overtrading, moving stops, increasing size after losses, holding
 *    losers, trading while stressed, breaking rules sometimes, and taking
 *    unplanned trades ALWAYS. Profit is not process; a trader can make
 *    money while behaving dangerously.
 *    → VALIDATES: the process-only score, P&L never a dimension, "become
 *      profitable" never a promised outcome. Retell this story publicly
 *      someday (anonymized) — it is the whole product argument in one row.
 *
 * 3. JOURNALING: WANT THE BENEFIT, REJECT THE CHORE. 3 of 5 keep no
 *    journal, 1 said Maybe, 1 said Yes — yet journal, progress tracking,
 *    personalized feedback and psychology coaching all appear in what
 *    would make them return daily. The gap is friction, not desire.
 *    → VALIDATES: the structured 4-stage loop over a blank journal;
 *      strengthens the future account-linking phases (statement import
 *      first, read-only linking later — see the regulatory map discussion,
 *      28 Sep 2026).
 *
 * 4. ACCOUNTABILITY IS A FELT ABSENCE. 3 of 5 have nobody holding them
 *    accountable; accountability appears both in their problems AND in
 *    their daily-return drivers. The product must create the feeling that
 *    "something is actually paying attention to how I'm trading."
 *    → VALIDATES: the coach's presence, score movement, the weekly letter;
 *      moves the DAILY BRIEF (AiFunctions function 6) up in priority.
 *
 * 5. PROCESS OVER PROFIT: valued 4.2/5 (R1 3, R2 3, R3 5, R4 5, R5 5).
 *    And 5 of 5 would use a platform that tracks their trading behavior
 *    and shows exactly what to improve.
 *    → VALIDATES: the problem statement and solution resonate with every
 *      respondent in this sample — enough to build and test; NOT claimed
 *      as product-market fit.
 *
 * 6. AFTER CONSECUTIVE LOSSES: 4 of 5 stop for the day; R5 "becomes more
 *    aggressive" — R5 is precisely the after-loss escalation pattern the
 *    engine's after-loss window detects, and the pattern catalog would
 *    name.
 *    → MOVES UP: the PATTERN CATALOG (AiFunctions function 1 gap) in the
 *      post-merge build order.
 *
 * 7. FUTURE OPPORTUNITIES: funding/opportunities appear in 4 of 5 answers;
 *    the one free-text wish was "easy access of funded account."
 *    → VALIDATES: Stage 3 as the destination, exactly as locked — funding
 *      comes after evidence. Also validates the prop-firm card reword
 *      (the demand is real; so is the need to not promise brokering it).
 *
 * ============================================================================
 * CORRECTIONS TO THE PDF (raw data wins)
 * ============================================================================
 * 1. Rule breaking: the PDF says "four of five"; the raw data says 5 of 5
 *    (all selected Sometimes or Often). Stronger, not weaker.
 * 2. Process-over-profit: the PDF first misprints the distribution, then
 *    corrects itself; actual: 2×3/5 and 3×5/5 → 4.2/5. Recorded here once.
 *
 * ============================================================================
 * RELATION TO THE BUILD (status note, 29 Sep 2026)
 * ============================================================================
 * The PDF's build plan (lock dimensions → define evidence per dimension →
 * structure the journal data → deterministic engine → pattern detection →
 * AI with structured context → the AI experiences → test with real
 * traders) is ALREADY IMPLEMENTED on the arena branch (PR #8), including
 * the three evidence levels (self-reported / behavioral / verified) that
 * the engine records as its evidence mix. Two independent analyses
 * converged on the same architecture; nobody should re-derive this as
 * "new" later. The genuinely next steps remain the five AiFunctions gaps,
 * with the pattern catalog and daily brief moved up per findings 4 and 6.
 *
 * MERGE STATUS (owner directive, 29 Sep 2026): NOT yet time to merge —
 * more survey responses incoming. PR #8 stays open as the review vehicle.
 *
 * ============================================================================
 * NEXT ROUND RECOMMENDATIONS (awaiting owner pick-up)
 * ============================================================================
 * - Target 30–50 responses before treating any theme as settled; at 5,
 *   themes are hypotheses.
 * - Add three questions to the next form iteration:
 *   1. Which journaling tool did you try, and why did you stop?
 *      (names the exact friction to kill)
 *   2. Would you connect your broker/exchange account read-only so trades
 *      import automatically? (directly tests the account-linking priority)
 *   3. How many minutes per day would you honestly spend logging?
 *      (budgets the loop design)
 * - The five opted-in emails are the first beta cohort. Invite all five
 *   personally at deploy; ask each for a 15-minute follow-up conversation
 *   (the PDF's "test with real traders" step — the list already exists).
 * - Round 2 should be behavioral where possible: watch what beta traders
 *   DO in the product, not only what they say in forms.
 * - Someday: publish anonymized findings ("we asked traders why they
 *   struggle — the profitable one had the worst habits"). Honest
 *   marketing that writes itself.
 *
 * ============================================================================
 * PRIVACY NOTE — OWNER DECISION (29 Sep 2026)
 * ============================================================================
 * The raw response files contain respondent email addresses and sit on
 * main of a publicly readable repo. OWNER DECISION, recorded verbatim in
 * substance: the raw files STAY on main until response collection is
 * complete, then the owner removes them personally. In this research
 * record, respondents are ALWAYS anonymous (R1–R5 labels; Round 2
 * continues R6, R7, …). Emails are never copied into this file, any
 * other repo file, docs, or chat.
 *
 * Verified 29 Sep 2026: no at-sign character exists anywhere in this
 * file, and no respondent address appears in any tracked file on this
 * branch.
 *
 * FOR REMOVAL DAY (when the owner deletes the raw files from main):
 * deleting the files removes them going forward, but git history retains
 * them. If stronger cleanup is wanted then, the options are a history
 * rewrite (needs force-push and coordination) or, simplest, rotating any
 * sensitive value — none is more sensitive than the emails themselves.
 * Decide then; nothing to do now.
 */
