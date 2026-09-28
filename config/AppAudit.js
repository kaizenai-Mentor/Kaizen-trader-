KAIZEN V2 — CORE LOOP AUDIT (IN-APP STEP 2)

Section-by-section audit of the core loop — dashboard.ejs, journal.ejs,
trading-style.ejs, and the engine path behind them (dashboardController,
Journal/User models, badges) — against the frozen in-app definition
(config/App.js). Same discipline as the public pages audit: KEEP / CHANGE /
REMOVE / ADD, grounded in verified code, before any code is written.


================================================================================
FACT-CHECK — SURPRISES FOUND IN THE V1 CODE
================================================================================

1. THE AI GENERATES THE SCORE TODAY. addJournal asks Claude to end its
   response with "DISCIPLINE SCORE: [X]%" and regex-parses it out
   (scoreMatch). The user-facing session score is literally invented by
   the AI per-entry, defaulting to 50. This violates the frozen principle
   ("AI explains the numbers; it never generates them") and is the single
   most important thing the V2 Score Engine fixes.

2. THE EMOTION FIELD IS HIDDEN. The journal form posts a hidden input
   emotion="Logged" — the UI no longer collects emotional state at all,
   even though the model and the AI prompt were built for it. V2's
   emotion chips + confidence restore it.

3. THERE IS NO JOURNAL EDIT OR DELETE ROUTE. Only POST /journal and
   GET /journal exist. Consequence: the one-time V1 extraction snapshot
   is inherently safe — entries cannot be retroactively edited today.
   (Keep it that way; if editing arrives later, it must not affect
   extracted evidence.)

4. AUTO-DETECT ALREADY EXISTS. Client JS extracts asset/timeframe from
   the freeform notes into hidden fields, and the AI returns an EXTRACTED
   line (outcome/rr/pips) that the controller parses. The extraction
   precedent the V2 cutover relies on is real, shipped code.

5. STREAK FREEZE GAMIFICATION EXISTS. User model has streakFreezeAvailable
   / streakFreezeUsedAt; streaks reset logic includes a Monday grace.
   V2 keeps it (it rewards consistency, not more trading).

6. THE PREDICTIVE WARNING IS DETERMINISTIC. getDashboard counts
   violations/FOMO/revenge mentions via regex over the last 5 sessions
   and renders high/medium/positive warnings. No AI involvement — exactly
   the V2 pattern-detection philosophy. Strong bones to keep and enrich.

7. MANTLE RECORDING FIRES ON JOURNAL EVENTS. addJournal writes
   compliance/credential records to Mantle (testnet) after scoring.
   Continues under V2 with the new credential objects.

8. TRADING STYLE IS 10 FREE-TEXT FIELDS, UNVERSIONED. riskPerTrade,
   dailyDrawdown, tradingEdge, entryRule, stopLossRule, takeProfitRule,
   emotionalTriggers, maxDailyTrades, maxPositionSize, markets — all
   Strings, no structure, no history. The AI prompt already consumes
   six of them; the V2 Trading System gives them a real home.


================================================================================
AUDIT 1 — dashboard.ejs + getDashboard (the future COCKPIT)
================================================================================

1.1 Header: "Discipline Dashboard / Welcome back, {user}. / Your
     discipline is your edge. 改善" + "View Bounties" button
VERDICT: CHANGE
Rename to the cockpit framing ("How am I improving?" greeting). Bounties
button demotes into the IDENTITY nav group per the frozen IA — no longer
dashboard chrome.

1.2 Predictive warning banner ("改 Kaizen AI — Before You Trade")
VERDICT: KEEP (enrich)
Deterministic multi-session detection — already the right architecture.
V2 feeds it richer signals (dimension trends, contradiction flags) and
renames labels to KAIZEN Score language.

1.3 Stats row: Discipline Score % (+ ELITE/CONSISTENT/BUILDING/DEVELOPING
     tier), Current Streak (+ freeze states), Total Sessions, On-Chain
     Rep card (→ /za/reputation)
VERDICT: CHANGE (major)
- Score card → the KAIZEN dial + five dimension meters (components
  already exist: partials/k-dial, k-meters). Tier labels retire with V1.
- Streak + freeze: KEEP as-is.
- Total sessions: KEEP.
- On-Chain Rep card: REMOVE from the stats row → lives in IDENTITY.

1.4 "Pre-Trade Reality Check" (freeform "Ask KAIZEN before you enter,
     30-second gut check" → AI response)
VERDICT: KEEP + INTEGRATE
Good feature, wrong slot. V2 gets a real structured PLAN stage (d8a);
the reality check survives as the optional "Ask KAIZEN" companion inside
the plan flow — the voice of the coach next to the declaration fields.

1.5 Recent Sessions list (asset, Compliant/Violated chip, sessionScore %,
     notes preview, View All)
VERDICT: KEEP (light)
Rename to Recent Sessions → stays; the Compliant/Violated chip becomes
plan-adherence aware once the plan stage exists.

1.6 "Discipline Progress — Last 10 Sessions" bar chart (green/red by
     ruleCompliance)
VERDICT: CHANGE
Becomes the dimension trend view (five-series mini chart + overall dial).
The binary compliant/violated coloring retires with the V1 score.

1.7 Achievements (badges) row + "Achievement Unlocked" toast
VERDICT: KEEP (reframe)
Badges → Milestones language per the frozen terminology. Score-tier
badges (40/60/80/95) re-anchor to V2 dimensions or convert to
credentials in the later badges→credentials phase. Session-count and
streak badges survive as-is (behavioral, score-independent).

1.8 Referral ("Copy Invite Link") + Quick Actions grid (7 links incl.
     Leaderboard, My Profile)
VERDICT: CHANGE
Quick Actions regroup to the V2 IA; Leaderboard link → My Progress.
Referral: KEEP (growth feature, out of loop scope).

1.9 MISSING — VERDICT: ADD (the cockpit definition, App.js B7)
- TODAY block: today's loop actions (make a plan / log a session /
  review yesterday's lesson) — the daily cockpit ritual.
- RECENT PATTERN card: the engine's latest detection with [Review] action.
- NEXT MILESTONE line ("13 sessions → 100-session milestone").
- CUTOVER EXPLAINER (one-time): five dimensions, whole-history extraction,
  V1 preserved as "V1 era" in the timeline.


================================================================================
AUDIT 2 — journal.ejs + addJournal (the future SESSIONS)
================================================================================

2.1 Freeform "Session Notes" textarea — the heart of the form
VERDICT: KEEP (it becomes the RECORD stage core, per the owner's
locked structure: freeform belongs to the main journal)

2.2 "Did you follow ALL your trading rules?" yes/no toggle
VERDICT: CHANGE → the QUICK CHECKS
This single boolean is the seed of the check row. V2 expands to the four
gap-fillers from the approved mockup: followed plan? / within entry
criteria? / respected risk? / outcome. (ruleCompliance remains as the
"followed plan" answer for backward compatibility.)

2.3 Hidden inputs: emotion="Logged", sessionScore=50, direction="Live
     Trade"; auto-detected asset/timeframe
VERDICT: CHANGE
- emotion → the chips + confidence slider (restores a lost data source).
- sessionScore hidden default → deleted; the engine computes, never the
  AI response parse (see fact-check 1).
- asset/timeframe auto-detect: KEEP (shipped precedent).

2.4 Outcome buttons (Win/Loss/Breakeven/No Trade)
VERDICT: KEEP (folds into the quick checks; AI EXTRACTED line stays as
the fallback when the user doesn't tap one)

2.5 RR Achieved + Pips/Points inputs
VERDICT: KEEP (optional metrics; future Risk-dimension evidence)

2.6 Chart image dropzone + AI vision + preview/remove UX
VERDICT: KEEP (works, and the AI prompt already accepts the image)

2.7 AI response panel + memory saving + no-API-key fallback text
VERDICT: KEEP (structure) / CHANGE (prompt contract — see 2.9)

2.8 Past sessions list
VERDICT: KEEP (light restyle)

2.9 MISSING — VERDICT: ADD
- PLAN stage before the record (d8a): setup (from system), entry
  condition, invalidation, predefined risk, emotional state + confidence.
  Structured declaration only — under a minute, not a journal.
- REFLECT stage after the record: what happened / did I follow my
  process / what did I learn / what would I change.
- Session states: plan saved → awaiting record → reflected → analyzed.
- The AI PROMPT CONTRACT changes: the prompt gains the plan-vs-record
  comparison and reflection; LOSES the "DISCIPLINE SCORE: [X]%" line
  (engine computes dimensions; the AI explains them and coaches). The
  EXTRACTED line evolves into the engine's structured-input extractor.


================================================================================
AUDIT 3 — trading-style.ejs + User.tradingStyle (the future MY TRADING
SYSTEM)
================================================================================

3.1 The 10 fields (risk, drawdown, edge, entry, SL, TP, triggers, max
     trades, max position, markets) with example placeholders
VERDICT: CHANGE → migrate into the Trading System object
All 10 fields survive migration 1:1 (values preserved). The AI prompt
keeps consuming them; now versioned.

3.2 Single unversioned object on User, all Strings
VERDICT: CHANGE
Becomes the versioned TradingSystem (App.js B4): numeric fields get
types, every save bumps version, history[] retains prior versions so
each Session is measured against the system version active at the time.

3.3 MISSING — VERDICT: ADD
- Setups (list) — the plan stage's "setup" dropdown source
- Market conditions / no-trade conditions — Process evidence
- Trading hours — Process/consistency evidence
- Psychological rules — Behavior evidence
- Version history view ("your rules, evolved")

3.4 Onboarding duplication (register.ejs collects the same 10 fields)
VERDICT: CHANGE (later phase)
Register's step 2/3 forms write the same object — they will create the
first TradingSystem version at signup. Audited fully in the onboarding
phase; noted here because the data model is shared.


================================================================================
AUDIT 4 — THE SCORE PATH (retired V1 formula → V2 engine)
================================================================================

4.1 getDashboard + addJournal: overallScore = compliant/total × 100,
     stored on User.disciplineScore, tier labels in the view
VERDICT: RETIRE AT CUTOVER
The V1 number freezes into history as "V1 era" (transition mechanics,
App.js B6). No new V1 writes after the engine ships.

4.2 AI-invented per-session score ("DISCIPLINE SCORE: [X]%")
VERDICT: REMOVE (fact-check 1)
The clearest V1 violation of the frozen determinism principle. The AI
keeps the coaching sections; the number becomes engine output.

4.3 Predictive warning regex detection
VERDICT: KEEP + ENRICH (feeds Behavioral Intelligence; gains dimension
trends and contradiction signals)

4.4 Badges (20: session counts, score tiers, streaks, psychology)
VERDICT: KEEP session/streak/psychology badges; RE-ANCHOR score-tier
badges (score_40/60/80/95) to V2 dimensions or convert to credentials
in the later phase

4.5 Mantle recording on journal events (testnet)
VERDICT: KEEP (credential records continue; testnet honesty maintained)

4.6 MISSING — VERDICT: ADD: the Score Engine itself
- services/scoreEngine.js: deterministic five-dimension computation from
  Session structured fields (declared data) + extracted V1 evidence
  (weighted lower, tagged) + rolling windows (immediate / 10–20 sessions
  / long-term) + contradiction detection + "building baseline" and
  "partial data" states + formula versioning.
- The one-time extraction job (V1 journals → tagged evidence).
- Score history store (per-user, formula-versioned, V1-era segment).


================================================================================
SUMMARY
================================================================================

dashboard.ejs      4 KEEP · 4 CHANGE · 1 REMOVE-item · 4 ADD   → the cockpit
journal.ejs        6 KEEP · 3 CHANGE · 0 REMOVE · 4 ADD       → the Session
trading-style.ejs  1 KEEP-SEED · 2 CHANGE · 5 ADD             → My Trading System
score path         2 KEEP · 1 RETIRE · 1 REMOVE · 1 RE-ANCHOR · 3 ADD → the engine

The headline finding: V1's bones are better than expected — freeform-first
journal, auto-detect, deterministic warnings, streak freeze, AI prompt with
trader-profile context are all KEEP-worthy. The fatal flaw is concentrated
in one place: the score. A compliant/total ratio wearing an AI-invented
per-session number. The V2 engine replaces exactly that and leaves the rest
standing.

BUILD LIST FOR THE CORE LOOP (feeds Step 3):
1. TradingSystem model + migration from User.tradingStyle
2. Session model (plan/record/reflect + checks) extending Journal
3. services/scoreEngine.js (five dimensions, windows, extraction weights)
4. One-time V1 extraction job
5. Sessions UI (plan stage d8a → record d8c → reflect)
6. Cockpit dashboard (dial, meters, today block, pattern, milestone,
   cutover explainer)
7. V2 nav IA (D9) + string renames


================================================================================
NEXT STEP
================================================================================

Step 3 — the spec/copy for the core loop: exact UI copy for the cockpit,
the plan/record/reflect flow, My Trading System editor, the cutover
explainer, and the engine's plain-language dimension explanations
("complex internally, simple externally" — what the trader actually
reads). Then Step 4 design, then Step 5 code.
