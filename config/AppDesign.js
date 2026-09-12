KAIZEN V2 — IN-APP STEP 4: CORE LOOP DESIGN SPEC

The presentation layer for the core loop (config/AppCopy.js copy +
config/App.js frozen definition), in the established V2 design language
(config/Design.js). Every mockup exists in BOTH themes (frozen rule);
the Gold Text Rule applies throughout (gold = brand + data; reading
color = language).

Mockups in this set (design/mockups/):
  cockpit-dark.jpg / -light.jpg        the dashboard as cockpit
  reflect-dark.jpg / -light.jpg        session stage three
  system-dark.jpg / -light.jpg         My Trading System editor
  (plan stage: d8a; record stage: d8c; gut check: gutcheck;
   nav: d9a; ticker: ticker-above-nav — all previously approved)

REUSED FROM THE SHIPPED DESIGN SYSTEM — no new primitives needed:
k-dial + k-meters (score instrument) · k-eyebrow/k-title (headers) ·
k-card levels (L1/L2/L3) · k-chip (pattern/state chips) · k-kanji 改
(the engine's mark) · k-seal 認 (verification only) · k-grid-bg texture
· reveal motion · legal layout (for any long-form in-app help).


================================================================================
1. THE COCKPIT (dashboard)
================================================================================

LAYOUT (desktop, 12-col mental model):
Row 0: ticker (only when an announcement is active) above navbar.
Row 1: greeting — eyebrow THE COCKPIT · H1 "Good morning, {name}."
       (name in gold — accent-word rule) · sub "How are you improving?
       改善" (reading color; 改善 in gold as brand mark).
Row 2 — LEFT (7 cols, the instrument cluster):
       score panel (L3 featured): 改 KAIZEN SCORE header row + k-dial lg
       (76–84 range for realism) + k-meters (five) + footnote
       "How you traded — not what you made." Tapping opens the "How is
       this scored?" explainer (sheet). Building/Partial states render
       in the footnote slot with mono status tags.
Row 2 — RIGHT (5 cols, the day):
       TODAY block (L2): max three loop items with gold check states;
       completion state "Loop complete. 改 See you tomorrow."
       below it: RECENT PATTERN card (L2, pattern chip + one plain
       sentence + Review Pattern ghost button) and NEXT MILESTONE strip
       (mono, gold progress fraction: "13 SESSIONS → 100-SESSION
       MILESTONE").
Row 3 — full width: BEFORE YOU TRADE banner (kept V1 warning design,
       enriched) — only when triggered; else omitted entirely.
Row 4 — essentials row (three L1 cards): RECENT SESSIONS (five, state
       chips PLANNED/RECORDED/REFLECTED/ANALYZED + session-type tag
       LIVE/BACKTEST/STUDY) · STREAK (freeze states) · TOTAL SESSIONS.
Row 5: MILESTONES strip (reframed badges) — collapsed to one row with
       a count chip; full list on My Progress (later phase).

WHAT'S ABSENT (frozen): P&L · rankings · on-chain cards · market noise.
GOLD USAGE: dial number, meter fills, accent words, chips' active
states, check marks. ALL sentences in reading color.

STATES TO DESIGN FOR (all mockup-visible eventually):
new user (building baseline) · partial data (extraction disclosure) ·
normal · returning-after-break (streak reset, warm welcome-back copy).


================================================================================
2. THE SESSION — STAGE THREE: REFLECT
================================================================================

(plan = d8a, record = d8c, both approved; this set adds reflect.)

Step strip (persistent across all three stages):
  PLAN → RECORD → REFLECT with ✓ states; active stage in gold.

LAYOUT: single column, max-width 640, L2 panel.
Header: k-eyebrow THE REFLECTION · title "A session becomes a lesson
here." · sub (reading color): "Four short answers. Yours, not KAIZEN's —
the AI responds after you finish."
Four prompt blocks, stacked, each: mono label + textarea:
  WHAT ACTUALLY HAPPENED?      (prefilled dim with one-line summary of
                               the record — editable? no; it's a prompt)
  DID YOU FOLLOW YOUR PROCESS?
  WHAT DID YOU LEARN?
  WHAT WOULD YOU CHANGE?
Typed answers in reading color; labels mono faint; the in-progress
block carries the gold focus border.
Footer: [Finish Session] gold primary · ghost link "Save draft".
After finish → the ANALYZED state: the coaching response (four sections,
no score line) beside the engine's instrument strip (dial sm + meters
sm), and the "How was this scored?" footer link.


================================================================================
3. MY TRADING SYSTEM (editor)
================================================================================

LAYOUT (desktop): two-column — LEFT: editor sections stacked; RIGHT:
sticky version rail.

Header: k-eyebrow MY TRADING SYSTEM · H1 "Your rules, evolved." ·
version tag chip "VERSION 3 · SAVED SEP 10" · migration notice banner
(one-time, dismissible).

Editor sections (cards, L1, each with mono section label):
  THE SYSTEM          name input ("London liquidity sweeps")
  STRATEGY            market conditions · setups (list, + add) ·
                      entry rules · exit rules
  RISK RULES          risk per trade · max position size · daily
                      drawdown · max trades per day (numeric steppers)
  TRADING HOURS       optional day/time ranges
  NO-TRADE CONDITIONS list ("No trades 30 min before red news")
  PSYCHOLOGICAL RULES list ("No entries after 2 losses without a break")

RIGHT RAIL (sticky): version history — v1 → v2 → v3 dots with dates and
one-line change summaries; "Each session is measured against the
version you traded it with."

Footer: [Save as New Version] (gold, full-width on mobile) — every save
bumps the version; nothing overwrites.

GOLD USAGE: version tag, section labels (eyebrow style), active list
items, the primary button. Inputs and text: reading color.


================================================================================
4. SESSION-TYPE CHIPS + TICKER INTEGRATION (cross-cutting)
================================================================================

- Session type tag on every session surface: mono chip LIVE (gold
  border) · BACKTEST (blue-border utility) · STUDY (ash border) — type
  is DATA, so color codes are informational, not brand.
- New Session opens with type choice (three large chips) then the plan
  stage; STUDY skips plan's trade-specific fields (entry/invalidation/
  risk become optional) and the record's quick checks become
  observation checks.
- Ticker (locked spec) renders above the navbar app-wide when an
  announcement is active; absent otherwise. First announcements:
  PRE ("V2 IS COMING…") then POST ("V2 IS LIVE…"), 20–25 day windows.


================================================================================
NEXT STEP
================================================================================

Owner reviews the six mockups (cockpit / reflect / system, dark +
light). On approval: Step 5 — code, in the audit's build order
(System model → Session model → scoreEngine + extraction → Sessions UI
→ Cockpit → nav + renames + ticker), with the preview server verifying
both themes before the branch merges (merge happens after auth pages +
functional spec, per the owner's locked sequence).
