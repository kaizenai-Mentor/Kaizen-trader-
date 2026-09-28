KAIZEN V2 — CORE LOOP COPY & SPEC (IN-APP STEP 3)

The exact user-facing copy for the core loop: the Cockpit, the Session
(plan → record → reflect), My Trading System, and the plain-language voice
of the Score Engine. Written against config/App.js (frozen definition +
locked D7–D10) and config/AppAudit.js (what exists / what changes).

Voice (frozen): plain, warm, direct. Short sentences. Written to help.
Numbers are mono. The trader is never talked down to. The kanji 改 marks
the engine.

Naming throughout: KAIZEN Score · five dimensions (Process, Risk,
Execution, Behavior, Learning & Consistency) · Session · Trading System ·
My Progress · Milestones.


================================================================================
1. THE COCKPIT (dashboard)
================================================================================

1.1 HEADER
Eyebrow:    THE COCKPIT
H1:         Good {morning|afternoon|evening}, {username}.
Sub:        How are you improving? 改善

[The question the page answers, per the frozen definition — not "how much
did you make today."]

1.2 SCORE BLOCK
Panel title: 改 KAIZEN SCORE
Dial label:  KAIZEN SCORE
Meters:      PROCESS · RISK · EXECUTION · BEHAVIOR · LEARNING
Footnote:    How you traded — not what you made.

State variants:
- Building:        "Building baseline — {n} of 10 sessions."
- Partial data:    "Partially estimated — from your written history."
                   (with the disclosure link, §5.4)
- Normal:          (no footnote beyond the standard one)

1.3 TODAY BLOCK  ("THE LOOP, TODAY")
Title:      TODAY
Items (state-aware, max three, in loop order):
  □ Make a plan          — no open plan today
  □ Record your session  — open plan awaiting record / or no session yet
  □ Review yesterday's lesson  — last session reflected but unread insight
Checked items show struck-through with a gold check. All three checked:
  "Loop complete. 改 See you tomorrow."

1.4 RECENT PATTERN CARD
Title:      RECENT PATTERN
Body (engine-generated, one at a time, plain language):
  "You tend to enter outside your planned setup after two losses in a
  row. It happened 3 times in your last 15 sessions."
Action:     [Review Pattern] → opens the pattern's evidence sessions
Positive variant (earned, not forced):
  "You've respected your stop on 9 of your last 10 planned trades. That's
  the discipline compounding."

1.5 NEXT MILESTONE LINE
Title:      NEXT MILESTONE
  "{n} sessions → the {milestone name} milestone"
Example:    "13 sessions → the 100-session milestone"

1.6 PREDICTIVE WARNING BANNER (kept from V1, enriched, deterministic)
Label:      改 KAIZEN — BEFORE YOU TRADE
High:       "Rules broken in {n} of your last 5 sessions. Review your
            entry criteria before opening any chart today."
Medium:     "FOMO is showing up repeatedly in your recent sessions. Stay
            off the charts until a valid setup forms."
Medium:     "Frustration is creeping into your writing. Only trade if
            you're genuinely neutral today."
Positive:   "{n} compliant sessions in a row. Your discipline is
            building. Protect it today."

1.7 RECENT SESSIONS / STREAK / TOTAL (kept, renamed)
RECENT SESSIONS — last five, state chips: PLANNED · RECORDED · REFLECTED
STREAK — {n} days (+ "Freeze ready" / "Freeze used this week")
TOTAL SESSIONS — {n}

1.8 MILESTONES (was Achievements)
Title:      MILESTONES
Toast:      MILESTONE REACHED — {name}

1.9 CUTOVER EXPLAINER (one-time modal, first login after the engine ships)
Title:      改 Your score just got sharper.
Body:
  KAIZEN now scores your trading across five dimensions — Process, Risk,
  Execution, Behavior, and Learning & Consistency.
  Your new score was calculated using your entire written history —
  every session you've ever logged counts, and wherever your notes
  contained the facts, we used them. Where they didn't, we say so
  instead of guessing.
  Your previous score ({v1}) is preserved in your progress timeline as
  "V1 era."
Button:     Show me my score


================================================================================
2. THE SESSION (plan → record → reflect)
================================================================================

2.0 PAGE HEADER
Title:      SESSIONS
Sub:        One loop at a time. Plan before you enter. Write what
            happened. Learn from it.
Primary:    [ + New Session ]

2.1 STAGE ONE — THE PLAN (structured declaration, under a minute)
Step strip: PLAN → Record → Reflect   (PLAN active)

Title:      NEW SESSION — THE PLAN
Sub:        Declare it before you do it. This is what KAIZEN measures
            you against.

Fields:
SETUP                    dropdown, from your Trading System
                         helper: "From your Trading System"
                         (+ "Add a setup" → shortcut to System editor)
ENTRY CONDITION          text
                         placeholder: "Price retests the demand zone"
INVALIDATION             text
                         placeholder: "Below the 4H swing low"
RISK                     dropdown, prefilled from your system
                         helper: "{riskPerTrade}% — from your system"
EMOTIONAL STATE          chips: CALM · FOCUSED · ANXIOUS · FOMO · REVENGE
CONFIDENCE               slider 1–10, mono value

Buttons:   [Save Plan]  [Ask KAIZEN]  [Skip — trade without a plan]

Ask KAIZEN (the V1 reality check, integrated): opens a small panel
  Label:   "30-second gut check — describe the moment"
  Placeholder: "About to enter AUDJPY short. 4H sweep confirmed but price
  is moving fast..."
  → AI responds in its coaching voice (no score, never a number).

Skip (honest, no shame):
  Note on save: "No plan on record. That's allowed — this session will
  carry less Process evidence. KAIZEN will nudge you to plan next time."

Plan saved state:
  Banner: "PLAN SAVED — {setup} · {risk}%. Now trade it exactly as
  written."
  Status chip on the session: AWAITING RECORD

2.2 STAGE TWO — THE RECORD (the main journal: freeform + quick checks)
Step strip: Plan ✓ → RECORD → Reflect   (RECORD active)

Title:      THE RECORD
Sub:        Write what actually happened. The quick checks catch what
            your notes don't mention.

Freeform area:
Label:      WHAT HAPPENED?
Placeholder: "Took the EURUSD short off the 4H sweep. Entry was clean
  but I moved my invalidation twice when price squeezed — that was fear,
  not strategy. Sized in properly at 1%..."

Auto-detect chip (existing logic, surfaced):
  "EURUSD · 30M · SHORT — DETECTED FROM YOUR NOTES ✓"

Quick checks (label + four rows):
Label:      QUICK CHECKS — ONLY WHAT YOUR NOTES DON'T MENTION
Followed your plan?         YES / NO / NO PLAN
Within your entry criteria? YES / NO
Respected your risk?        YES / NO
Outcome                     WIN / LOSS / BREAKEVEN / NO TRADE
(untouched rows default to "not mentioned" — never assumed)

Optional metrics (kept): RR ACHIEVED (e.g. 1:2.5) · PIPS/POINTS (+45)
Chart image (kept): dropzone + ATTACH CHART

Buttons:   [Attach Chart]  [Save & Reflect →]

2.3 STAGE THREE — REFLECT
Step strip: Plan ✓ → Record ✓ → REFLECT   (REFLECT active)

Title:      THE REFLECTION
Sub:        A session becomes a lesson here.

Prompts (four, short):
  What actually happened?
  Did you follow your process?
  What did you learn?
  What would you change?

Button:     [Finish Session]

Post-session:
  改 KAIZEN responds (coaching sections kept from the V1 prompt contract:
  what you executed well / where the breakdown occurred / pattern KAIZEN
  is tracking / one thing to focus on — NO score line; the engine's
  numbers render as instruments beside the response).
  Status chip: ANALYZED
  Footer link: "How was this scored? →" (§5.3 explainer)

2.4 SESSION HISTORY LIST
Columns/chips: date · asset · state (PLANNED → RECORDED → REFLECTED →
ANALYZED) · plan adherence dot
Filter:     ALL · THIS WEEK · WITH PLAN · WITHOUT PLAN · VIOLATIONS
Empty:      "No sessions yet. Your first one starts with a plan."

2.5 PLAN-LESS NUDGE (appears once, after a plan-less session is analyzed)
"Logging without a plan still counts — your history matters. But the
traders who improve fastest declare first, then trade. Make your next
one a planned session."


================================================================================
3. MY TRADING SYSTEM
================================================================================

Header:     MY TRADING SYSTEM
Sub:        Your rules, evolved. KAIZEN measures every session against
            the version you had at the time.
Version tag: VERSION {n} · SAVED {date}

Sections:
THE SYSTEM      Name (e.g. "London liquidity sweeps")
STRATEGY        Market conditions · Setups · Entry rules · Exit rules
RISK RULES      Risk per trade · Max position size · Daily drawdown ·
                Max trades per day
POSITION RULES  (freeform, optional)
TRADING HOURS   (optional)
NO-TRADE CONDITIONS  (e.g. "No trades 30 min before red news")
PSYCHOLOGICAL RULES  (e.g. "No entries after 2 losses without a break")

Button:      [Save as New Version]
After save:  "Version {n+1} saved. Sessions before today were measured
             against the version you traded them with."

Migration notice (one-time, for existing users):
"Your trading style moved into your Trading System — nothing was lost.
Add setups and no-trade conditions when you're ready; they make your
plans faster and your score sharper."


================================================================================
4. NAVIGATION LABELS (D9 — V2 grouped IA, final strings)
================================================================================

IMPROVE     Dashboard · Sessions · My Progress
COACH       KAIZEN AI · Psychology · Memories
TOOLS       Chart · Weekly Report
IDENTITY    Wallets & Verification
SETTINGS    My Trading System · Account & Security
INFO        Help · Support · About · Services

Renames elsewhere in-app:
  "My Journal"            → "Sessions"
  "Update Trading Style"  → "My Trading System"
  "Reputation"            → "Wallets & Verification"
  "Leaderboard"           → "My Progress" (challenges arrive there later)
  "Market News"           → demoted from nav (reachable via Tools page)


================================================================================
5. THE SCORE ENGINE'S VOICE (complex internally, simple externally)
================================================================================

5.1 DIMENSION DISPLAY (always the same five, same order)
PROCESS — "Do you follow your own system?"
RISK — "Do you protect yourself from unnecessary losses?"
EXECUTION — "Do your trades match your plan?"
BEHAVIOR — "What does your psychology make you do?"
LEARNING — "Are you becoming better?" (label: LEARNING)

5.2 DIMENSION EXPLANATION TEMPLATE (per dimension, on tap)
"{Dimension} — {score}.
{One factual sentence from the evidence.}
{One plain-language sentence of what it means.}"
Example:
"Process — 88.
You followed your plan in 8 of your last 10 planned sessions, and you've
planned 10 sessions in a row.
When you declare first, you follow through. Keep protecting that."

5.3 "HOW IS THIS SCORED?" (honest explainer, linked everywhere the score
appears)
"Your KAIZEN Score is computed from what you actually do in KAIZEN —
your plans, your records, your quick checks, your reflections — measured
against the Trading System you wrote. It rewards better decisions, never
more trading.
It is not a profit forecast. A high score means you trade the way you
said you would. That's all it ever claims.
Where your history only partially supports a dimension, we tell you
instead of inventing a number."

5.4 EXTRACTION DISCLOSURE (shown while evidence is partly extracted)
"Some of this dimension comes from facts KAIZEN read out of your written
history — like a stop you mentioned respecting. Those are marked
'extracted' and count less than facts you declared directly."

5.5 CONTRADICTION NOTICE (rare, factual, never accusatory)
"Your record for this session doesn't match your plan ({fact}). Scored
as a deviation — that's the point of writing both down."

5.6 WHAT THE ENGINE NEVER SAYS
No profitability promises. No "elite/master" tier labels (retired with
V1). No shaming language. No number the engine didn't compute.


================================================================================
STRING RENAME MAP (in-app surfaces, applied in Step 5)
================================================================================

"Discipline Score"        → "KAIZEN Score"
"Discipline Dashboard"    → "The Cockpit"
"My Journal"              → "Sessions"
"Log Session"             → "New Session"
"Update Trading Style"    → "My Trading System"
"Reputation"              → "Wallets & Verification"
"Leaderboard"             → "My Progress"
"Achievements"            → "Milestones"
"Achievement Unlocked"    → "Milestone Reached"
"Compliant / Violated"    → plan-adherence chips (state-based)
score tier labels         → retired (ELITE/CONSISTENT/BUILDING/DEVELOPING)
"DISCIPLINE SCORE: X%"    → removed from the AI response contract entirely


================================================================================
NEXT STEP
================================================================================

Step 4 — Design. The cockpit, the three-stage session flow, My Trading
System editor, and the score components in the V2 design language —
every mockup in BOTH themes (dark + light), per the frozen rule.
Then Step 5 — code, in the audit's build order:
System model → Session model → scoreEngine + extraction → Sessions UI →
Cockpit → nav + renames.
