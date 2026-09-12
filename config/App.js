KAIZEN V2 — IN-APP STEP 1: THE FROZEN APP EXPERIENCE

The public pages told the story. The app has to live it. This document freezes
what the in-app experience IS before any page gets audited (Step 2), rewritten
(Step 3), designed (Step 4), or coded (Step 5).

Sources of truth: config/New.js (V1 blueprint), config/Start.js (frozen
decisions 1–20), config/Copy.js (public language now live), config/Design.js
(the design system). Nothing in this document contradicts those.


================================================================================
A. INVENTORY — WHAT EXISTS TODAY AND ITS V2 FATE
================================================================================

Page (view)            Route              Today                                V2 Fate
─────────────────────  ─────────────────  ───────────────────────────────────  ─────────────────────
dashboard.ejs (868)    /dashboard         Score %, streak, "Before You Enter"  REBUILD → the cockpit
                                         checklist, recent sessions, chart,
                                         achievements, AI insights
journal.ejs (384)      /dashboard/journal Post-trade form: asset, timeframe,   REBUILD → the Session
                                         direction, outcome, emotion, notes,   (plan → record →
                                         ruleCompliance, sessionScore, chart   reflect → analyze)
psychology.ejs (285)   /psychology        Chat with KAIZEN AI about mindset    KEEP (light restyle)
kaizen-ai.ejs (163)    /kaizen-ai         AI analysis surface                  KEEP (merge into Coach)
memories.ejs (156)     /memories          Archive of all AI responses          KEEP (light restyle)
leaderboard.ejs (209)  /leaderboard       Weekly + all-time score rankings     REPLACE → My Progress
weekly-summary.ejs     /weekly-summary    Weekly digest page                   KEEP (rename strings)
(129)
trading-style.ejs      /settings/...      Form: risk per trade, drawdown,      REBUILD → My Trading
(142)                                     entry/exit/SL/TP rules, edge,        System editor
                                          triggers, markets
news.ejs (109)         /news              Market news feed                     KEEP (demote from nav)
chart.ejs (614)        /chart             TradingView chart + drawings         KEEP (light restyle)
bounties.ejs (98)      /za/bounties       ZA DAO bounties list ("Discipline    MOVE → under Identity
                                          Challenges")                         & Verification/ZA
reputation.ejs (452)   /za/reputation/:u  Wallet, ZA profile, Mantle stats     REBUILD → Identity &
                                                                               Verification
public-profile.ejs     /reputation/:userId Public trader profile               DEFER (Trader Profile
(283)                                                                      is a later phase);
                                                                            strings renamed only
help.ejs (491)         /help              Help center                          KEEP (terminology pass)
support.ejs (121)      /support           Support page                         KEEP (light)
register.ejs (222)     /auth/register     3-step signup + trading style        REBUILD → onboarding:
                                                                            profile → system →
                                                                            first session
login.ejs              /auth/login        Login                                KEEP (light restyle)

Backend objects in scope:
- User.tradingStyle fields (riskPerTrade, dailyDrawdown, maxPositionSize,
  maxDailyTrades, entryRule, stopLossRule, takeProfitRule, tradingEdge,
  markets, emotionalTriggers) → migrate into the Trading System object
- Journal model → extended into the Session model (backward compatible)
- dashboardController score math (compliant/total ratio) → retired, replaced
  by the Score Engine
- behaviorMetrics + rulesEngine (on-chain cadence metrics) → OUT of scope for
  the score; remain wallet-evidence tools under Identity & Verification


================================================================================
B. THE FROZEN APP DEFINITION
================================================================================

B1. THE APP'S SINGLE JOB
Run the improvement loop for the trader, every day:
PLAN → TRADE → REFLECT → ANALYZE → IMPROVE → REPEAT
Every in-app page either runs the loop, feeds it, or shows its results.
A page that does none of those does not belong in the primary navigation.

B2. IN-APP TERMINOLOGY FREEZE
- KAIZEN Score — one number, five dimensions. "Discipline Score" is retired.
  Internal code identifiers (disciplineScore field, DisciplineCredential
  model) are renamed when their engines are rebuilt in this phase.
- The five dimensions — Process, Risk, Execution, Behavior,
  Learning & Consistency. Always the same order, same names, everywhere.
- Session — one loop iteration: the pre-trade plan, the record, and the
  reflection. "Journal entry" remains the free-text part of a Session.
- Trading System — the user's own rules object the app measures against.
- My Progress — the comparison of you vs your past self. Never a ranking.
- Milestones — behavioral achievements (the badge layer, reframed).
- KAIZEN AI — the engine that analyzes and coaches. Its mark is 改.
- Identity & Verification — wallets, credentials, Web3 reputation. Optional.

B3. NAVIGATION IA (V2)
Primary nav groups (popup menu rebuilt to this):

  IMPROVE      Dashboard · Sessions · My Progress
  COACH        KAIZEN AI · Psychology · Memories
  TOOLS        Chart · Weekly Report
  IDENTITY     Wallets & Verification (incl. ZA reputation + bounties)
  SETTINGS     My Trading System · Account & Security
  INFO         Help · Support · About · Services

Market News: removed from primary nav (stays reachable; it's a convenience,
not part of the loop).

B4. THE KAIZEN TRADING SYSTEM (first-class object)
The app cannot score adherence without knowing intent. The Trading System
becomes a versioned object (users refine it over time; each Session is
measured against the system version that was active when it happened):

  name, marketConditions, setups, entryRules, exitRules,
  riskRules (riskPerTrade, maxPositionSize, dailyDrawdown, maxDailyTrades),
  positionRules, tradingHours, noTradeConditions, psychologicalRules,
  version, history[]

Existing User.tradingStyle data migrates in on first visit (nothing lost).
Register onboarding and the settings editor both write this object.

B5. THE SESSION (journal 2.0 object)
One object, three stages:

  PRE-TRADE PLAN (before)          RECORD (after)              REFLECTION
  ─ setup (from system)            ─ asset, timeframe,         ─ what happened?
  ─ entry condition                  direction, outcome         ─ did I follow my
  ─ invalidation                   ─ followed plan?              process?
  ─ predefined risk                ─ changed plan?             ─ what did I learn?
  ─ reason for entering            ─ entered outside             ─ what would I
  ─ emotional state + confidence     criteria?                    change?
  ─ checklist (from system)        ─ violated risk rules?      (then KAIZEN AI
                                   ─ revenge trade?              responds)
                                   ─ optional chart image

Backward compatible: old journal entries remain valid Sessions with the
plan stage empty. The engine treats "no plan" as reduced Process evidence
(a prompt to plan, not a punishment).

B6. THE KAIZEN SCORE ENGINE
- Five dimensions, weighted, 0–100 overall. Complex internally, simple
  externally: the trader sees five numbers and plain-language reasons.
- Deterministic core: metrics are computed from structured data (plans,
  records, reflections, consistency, contradictions). AI explains the
  numbers and coaches; it never generates them. (Same principle the
  behaviorMetrics service already documents.)
- Multi-signal anti-gaming: immediate session data + 10–20 session
  patterns + long-term trend + contradiction detection. A single action
  never produces a meaningful score change.
- Honesty: the score measures behaviors associated with better trading
  practice. It never claims profitability. Wallet ownership is never a
  score input.
- Cold start: below a baseline number of sessions, dimensions show as
  "building baseline" instead of fake numbers.
- Versioned: formula changes are logged; every user's score history keeps
  the formula version it was computed with.

TRANSITION MECHANICS (locked with D7, 13 Sep 2026):
- At cutover, the V1 score FREEZES at its last computed value. It is
  never recalculated again. During the 10-day dual window it displays
  labeled "V1 era"; on day 11 it retires into history.
- The V2 engine does NOT compute dimensions from V1 sessions. V1 journal
  entries lack the data the dimensions require (no pre-trade plans, no
  risk records, no structured reflection fields). Inventing dimension
  values from that thin data would fake precision — forbidden by the
  honesty rules.
- V2 dimensions build exclusively from sessions logged after cutover
  (plan → record → quick checks → reflection). Until enough V2 sessions
  exist, dimensions show "building baseline" rather than fake numbers.
- Old journals remain fully alive as HISTORY and AI CONTEXT: KAIZEN AI
  still reads them for patterns and coaching ("you've documented this
  sequence three times"); they simply never feed dimension math.

B7. PAGE-BY-PAGE FROZEN DEFINITIONS (one line each)

DASHBOARD — the cockpit. Greets, answers "How am I improving?", shows the
score dial + five dimensions, today's loop actions (checklist, log session,
review yesterday's lesson), the latest detected pattern, and the next
milestone. It does not look like a generic trading dashboard.

SESSIONS (journal) — where the loop happens. Log a session = plan →
record → reflect → receive AI analysis. History list with filters.

MY PROGRESS — replaces the leaderboard. Score history, dimension trends,
streaks, milestones, week-over-week/month-over-month comparison against
your past self. Challenges arrive here later.

KAIZEN AI / PSYCHOLOGY / MEMORIES — the Coach pillar, kept: analysis chat,
mindset chat, and the permanent archive of everything the AI ever told you.

WEEKLY REPORT — the weekly digest, renamed terminology, kept.

CHART — TradingView tool, kept.

IDENTITY & VERIFICATION (was reputation.ejs) — one page: connected wallets
(private by default), credentials + Mantle records (testnet labeled),
optional ZA reputation and its bounties. No blockchain jargon in the UI.

MY TRADING SYSTEM (was trading-style.ejs) — the system editor with version
history: "your rules, evolved."

ONBOARDING (register) — account → build your first Trading System (guided,
with "you can refine later") → log your first session. The journey steps
JOIN → PROFILE → RULES → PLAN → LOG made real.

B8. EXPLICITLY NOT IN THIS PHASE
- XP and the seven levels (Observer → Kaizen Trader) — designed for, built
  after the score engine proves itself.
- Challenges/seasons engine (arrives in My Progress later).
- Trader Profile (public-profile deep rebuild) and Trader Card.
- Credential minting to Mantle beyond what exists today.
- Wallet connection UI redesign beyond moving it.
- Financial account integrations (future architecture only).


================================================================================
C. DECISIONS NEEDED BEFORE STEP 2
================================================================================

D7. SCORE CONTINUITY — LOCKED (owner, 13 Sep 2026): DUAL TRANSITION, 10 DAYS.
    The V1 score and the V2 KAIZEN Score are shown side by side for 10
    days, then the V1 score retires into history. Existing users see the
    five dimensions begin building immediately; the V1 number is labeled
    "V1 era" throughout and disappears from the UI on day 11.

D8. PRE-TRADE PLAN DEPTH — DIRECTION LOCKED, LAYOUT PENDING MOCKUP:
    The Session is FREEFORM-FIRST. The journal entry (free writing) is
    the heart of the record stage; a few smart quick-checks capture the
    structured facts a trader might not mention in their writing (followed
    plan? within entry criteria? respected risk? outcome?). KAIZEN reads
    both. Mockup: design/mockups/d8c-freeform-journal.jpg — awaiting
    owner approval.

D9. NAVIGATION — LOCKED (owner, 13 Sep 2026): V2 GROUPED IA.
    The app menu restructures to the B3 groups in this phase.

D10. REBUILD ORDER — LOCKED (owner, 13 Sep 2026): THE CORE LOOP AS ONE
    PHASE. Score Engine + Dashboard + Sessions go through Steps 2–5
    together, then the remaining pages follow.
