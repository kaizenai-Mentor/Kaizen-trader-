# KAIZEN V2 — Page Functional Specification

**What this is.** The detailed, per-page functional spec for every surface in the product —
the "functions of each page" step of the locked sequence (core loop pages → auth pages →
**this spec** → commit & merge). It is written against the code that exists on
`arena/01a08895-kaizen-trader` (M1–M3 + auth shipped) and against the frozen specs in
`config/` (App.js, AppCopy.js, AppDesign.js, CoreLoop.js, AppAudit.js, Design.js, Start.js).

**How to read it.** Each page has: purpose → entry points → layout (mobile-first) →
states → data & logic → rules (integrity / copy / theme) → acceptance criteria →
build status. "Owner decision" marks a point that is genuinely yours to make;
everything else is decided and consistent with the frozen specs and the locked
master vision in `docs/VISION.md`.

**Status legend.** ✅ LIVE (built in V2 code) · 🔁 CARRIED (V1 page still serving, V2
treatment specified here) · 🔨 REBUILD (page must be rebuilt to the spec below).

---

## 0. GLOBAL RULES — apply to every page

1. **Gold text rule** (frozen): gold belongs to brand + data only — the 改 KAIZEN
   wordmark, the single accent word "KAIZEN" in titles, eyebrows/section kickers,
   instrument values (scores, meter fills, metrics), and active states/links. All
   language (headlines, body, inputs, tables) uses the reading color. Dark gold
   `#C9A84C`, light gold `#B8960C`. Never gold paragraphs.
2. **Both themes, always**: no page is approved until it has been seen in dark AND
   light. Theme toggle is reachable on every page (navbar ◐ / side menu).
3. **Mobile-first**: every layout is designed single-column at 360–430px width,
   then enhanced at ≥900px. Tap targets ≥44px. The owner reviews on Android —
   mobile is the primary acceptance context, not an afterthought.
4. **Announcement ticker** (locked spec, `config/CoreLoop.js`; placement revised
   by owner 17 Sep 2026): renders directly BELOW the navbar ONLY while an
   announcement is active. Megaphone badge fixed at the right
   end + mono "UPDATE" label; text scrolls right→left; ~34px tall; × dismisses for
   the session; prefers-reduced-motion → static text swapping ~8s.
5. **Two machines, one voice** (frozen): the ENGINE measures (deterministic score
   from structural session signals); the COACH (KAIZEN AI, 改) explains and
   converses. The AI never scores; the engine never editorializes. Every page that
   shows a number shows it from the engine; every page that speaks shows the coach.
6. **Honesty labels**: practice consistency is never presented as trading
   performance. Streaks, session counts and milestones are labeled as practice.
   Wallet/on-chain evidence is labeled as verification, never as skill.
7. **Never punish perfection**: high compliance is never a flag. Variance checks
   key on fabrication signatures only (duplicate text, cadence violations, data
   uniformity), and uniformity gates milestone/reputation credit — never scores.
8. **prefers-reduced-motion**: all animations degrade to static/instant.
9. **The armor is invisible** (owner decision, 13 Sep 2026): user-facing copy
   NEVER describes the integrity layer's detection mechanics — no anti-gaming
   talk, no mention of novelty/cadence/uniformity checks, no "this can't be
   gamed" claims in onboarding, explainers, or marketing. Honest users don't
   need the warning; would-be farmers don't get a roadmap. The layer is visible
   only in its effects — honest labels on the user's own flagged content. The
   Terms of Service keeps only the legal prohibition and consequence, without
   the signal list.

---

## 1. BUILD STATUS LEDGER

| Page | Route | Status | Shipped in |
|---|---|---|---|
| Cockpit | `/dashboard` | ✅ LIVE | M3 (`91663e0`) |
| Sessions list | `/dashboard/sessions` | ✅ LIVE | M2 (`2055e7f`) |
| Plan / Record / Reflect / Analyzed | `/dashboard/sessions/…` | ✅ LIVE | M2 (`2055e7f`) |
| My Trading System | `/settings/trading-system` | ✅ LIVE | M3 (`91663e0`) |
| Login | `/auth/login` | ✅ LIVE (restyle) | Auth (`67569df`) |
| Register / Onboarding | `/auth/register` | ✅ LIVE (rebuild) | Auth (`67569df`) |
| **Psychology** | `/psychology` | ✅ LIVE (rebuilt) | `69a732d` |
| KAIZEN AI | `/kaizen-ai` | ✅ LIVE (rebuilt) | see git log (§3.2) |
| Memories | `/memories` | 🔁 CARRIED → restyle | this doc §3.3 |
| My Progress | `/leaderboard` | ✅ LIVE (rebuilt) | see git log (§2.8) |
| Weekly Report | `/weekly-summary` | ✅ LIVE (rewired) | see git log (§4.2) |
| Chart | `/chart` | 🔁 CARRIED (kept) | this doc §4.1 |
| Market News | `/news` | 🔁 CARRIED (kept) | this doc §4.3 |
| Wallets & Verification | `/za/reputation/:id` | 🔁 CARRIED | this doc §5 |
| Public pages | `/`, `/about`, `/services`, `/terms`, `/help`, `/support` | ✅ approved (public phase) | `4b18555` |

---

# 2. IMPROVE PILLAR

## 2.1 COCKPIT — `/dashboard` ✅ LIVE

**Purpose.** The honest answer to "how am I improving?" — one screen: the score
instrument, today's actions, the recent pattern, the next milestone, the essentials.
No P&L, no on-chain reputation, no noise.

**Entry points.** Post-login landing; logo tap from any in-app page; "Back to
Cockpit" from the Trading System editor; nav → Improve → Cockpit.

**Layout (mobile-first).**
1. Head — eyebrow `COCKPIT · 改`, greeting + "One honest question: how are you
   improving?", streak chip (right; mono number, "day streak", practice label in
   the tooltip).
2. Score instrument card — overall KAIZEN Score (mono, gold) + state chip
   (READY / PARTIAL — FROM YOUR WRITTEN HISTORY), "From your last N sessions",
   link "How is this scored?" → `/about#kaizen-score`; five dimension meters
   (label · track · mono value); WHY THIS NUMBER — up to three reasons, one line
   each, dimension name in mono gold.
   - No score yet → **Building your baseline**: 改 medallion + "No score yet —
     and that's honest, not broken…"
3. TODAY card — action rows derived from session state (see logic). "Today is
   complete. Rest is also discipline."
4. RECENT PATTERN card (only when there is one) — deterministic pattern message
   (high/medium/positive left-border), footer "A pattern is a signal, not a
   verdict — the next session is what counts."
5. NEXT MILESTONE card — label, progress track (data-meter), "N to go · My Progress".
6. ESSENTIALS card — recent 5 sessions (type tag, asset, state, date; row links to
   the session's current stage), footer: total sessions · milestones · System vN.
7. Milestone toast (when new badges land) · one-time cutover modal (see below).

**Data & logic.**
- Score = latest `ScoreSnapshot` (lean). If none exists (first V2 visit), compute
  once: `runV1Extraction` (one-time, guarded by `user.v1ExtractedAt`) →
  `computeScore(recent ≤60 sessions, system, extracted)` → snapshot persisted.
- TODAY actions (priority order): open PLANNED session → "Record your session";
  nothing today → "Plan today's session" (first-ever copy variant: "The score
  builds as you go, no instant judgment"); today RECORDED → "Reflect on today's
  session"; today REFLECTED → "Read your analysis"; else last ANALYZED → "Review
  your last lesson".
- RECENT PATTERN — deterministic scan of last 5 sessions: ≥3 violations → high;
  FOMO ×2 → medium; frustration language → medium; 0 violations → positive
  ("protect this streak"). Same thresholds as V1 (carried deliberately).
- Next milestone — session count vs [5,10,25,50,100,250,500].
- Cutover explainer — first visit after engine ships (`user.scoreCutoverShownAt`
  null): modal "Your Discipline Score is now your KAIZEN Score" — five dimensions,
  WHY, Building honesty, the loop. Sets the flag server-side on render.
- New-user intro (D1 — ✅ BUILT): one-time "How your KAIZEN Score works"
  modal for accounts created after V2 launch (five dimensions, WHY, Building
  honesty; no anti-gaming mention — rule 9; User.scoreIntroShownAt).
- `/about#kaizen-score` (✅ BUILT): "How is this scored?" section — fixed
  formula, five dimension cards, WHY + Building honesty, rule-9 clean.

**Rules.** Gold: score, meter fills, dimension labels, streak number, links.
Everything else reading color. Light-theme parity via CSS variables. Meters
animate via `v2-reveal.js` (data-meter), reduced-motion → instant.

**Acceptance criteria.**
- Fresh account → Building state, no score, cutover modal NOT shown (nothing to
  explain yet — modal is for users with V1 history). *(See open question Q1.)*
- Account with V1 history → first load computes snapshot; cutover modal exactly
  once; PARTIAL label when evidence mix is partial.
- Every TODAY action links to the correct stage route.
- No P&L, no wallet/reputation content anywhere on the page.
- Both themes; single column ≤900px; no horizontal scroll at 360px.

---

## 2.2 SESSIONS LIST — `/dashboard/sessions` ✅ LIVE

**Purpose.** The record of work: every session (LIVE / BACKTEST / STUDY), its
stage, its type, its date. Nothing hidden, nothing deletable.

**Layout.** Head ("Sessions" + count + "New Session" button) → open-plan banner
(if a PLANNED session exists: type, setup, "Continue to record") → list rows:
type tag · asset/title · state chip (PLANNED/RECORDED/REFLECTED/ANALYZED) · date;
row taps route to the session's current stage. Empty state: "No sessions yet —
your improvement record starts with one plan" + CTA.

**Rules.** Sessions are never deleted (frozen). List is chronological, newest
first, paginated (20/page). Type tag colors: LIVE gold-tinted, BACKTEST blue,
STUDY green — tags are data, may carry hue.

**Acceptance.** Row destination correct per state; open-plan banner shows only
while a PLANNED session exists; legacy `/dashboard/journal` GET redirects here.

---

## 2.3 PLAN — `/dashboard/sessions/new` ✅ LIVE

**Purpose.** Decide what you're looking for BEFORE you look. The plan is what
execution is later measured against.

**Flow.** Stepstrip `Plan — Record — Reflect — Analyzed` (active = Plan).
1. **Type** — three type cards: LIVE ("real money on the line"), BACKTEST
   ("replay history, same honesty"), STUDY ("chart time, marking up, no position").
2. **The plan form** (type-aware):
   - Asset · timeframe · setup — setup dropdown populated from the Trading System
     (`system.setups`); free text allowed if none match.
   - Entry condition — "What exactly are you waiting for?"
   - Invalidation — "What tells you you're wrong?"
   - Predefined risk — pulled from `system.riskRules` as the default.
   - Emotional state (chips) + confidence (1–10 slider) — how you feel GOING IN.
   - STUDY type: study goal replaces entry/invalidation.
   - **Honest skip** — "Not planning today — I'll log what happened": creates a
     session with `plan.skipped = true`. Reduced Process evidence, never a
     punishment (0.35 plan credit, engine-side).
3. Save → state `PLANNED` → redirect to Record.

**Rules.** `systemVersion` stamped on the plan (the session is later judged
against the rules that existed at the time). No score movement at plan time.

**Acceptance.** Setup dropdown reads from the user's system; honest skip works;
type cards select on tap (mobile) with clear active state; both themes.

---

## 2.4 RECORD — `/dashboard/sessions/:id/record` ✅ LIVE

**Purpose.** What actually happened — freeform first, structure second.

**Layout.** Stepstrip (Record active) → plan reference card (setup, entry
condition, invalidation, risk — what you said you'd do) → **"What happened?"
freeform textarea first** → quick checks (followed entry / respected stop /
respected risk / traded within hours) → outcome (Win/Loss/Breakeven/No Trade —
enum-validated; STUDY forces No Trade) → R:R achieved · pips (optional) →
chart image upload (optional; stored chart-agnostically, B8).

**Logic.** Auto-detect inside the freeform (asset mentions, outcome words,
numbers) fills the structured fields only when left empty — detected values are
shown as pre-filled, user can correct. Quick checks + plan comparison feed the
engine's Process/Execution/Risk dimensions. Save → state `RECORDED` → Reflect.

**Rules.** Never-delete. Novelty guard: word-similarity >0.9 vs recent sessions →
`evidenceFlags.duplicateOf` (Behavior evidence; zero reflection credit engine-side).
A record with no reflection yet is honestly labeled RECORDED, not ANALYZED.

**Acceptance.** Plan reference visible while recording; enum validation rejects
bogus outcomes (400, friendly message); image upload optional and non-blocking;
STUDY → outcome locked to No Trade; both themes; mobile composer comfortable
one-handed.

---

## 2.5 REFLECT — `/dashboard/sessions/:id/reflect` ✅ LIVE

**Purpose.** The user's own words, written by the user — four prompts. KAIZEN AI
responds AFTER, never before, never instead.

**The four prompts** (frozen):
1. What happened? (vs the plan)
2. Did you follow your process?
3. What did you learn?
4. What would you change?

**Logic.** Save → state `REFLECTED` → the ANALYZE chain runs server-side:
one-time V1 extraction → `computeScore` → new `ScoreSnapshot` →
`aiCoach.analyzeSession` (plan-vs-record comparison in the prompt; EXTRACTED tail
fills outcome only when 'Pending') → response persisted → state `ANALYZED` →
redirect to detail. Badge/streak check runs here (V1 `config/checkBadges`).

**Rules.** Reflection substance feeds Learning (0.3 substance weight). Duplicate
reflection text → zero reflection credit. The AI response NEVER contains a score
line ("DISCIPLINE SCORE: X%" is dead in V2 — the prompt contract forbids it).

**Acceptance.** Four prompts all optional-but-encouraged (empty allowed, marked
"honest skip" engine-side); state machine rejects jumping stages; after save the
user lands on the detail page with the coach's response present (or the
deterministic fallback when no API key — always honest, never blank).

---

## 2.6 SESSION DETAIL (ANALYZED) — `/dashboard/sessions/:id` ✅ LIVE

**Purpose.** The closed loop: the coach's response (left/first) + the engine's
numbers (right/second on desktop, stacked on mobile).

**Layout.** Stepstrip (all done, Analyzed active) → title "ASSET — the session,
closed." → coach card `改 KAIZEN RESPONDS` (the analysis text) → engine card
`THE ENGINE — AFTER THIS SESSION`: overall + five meters + WHY (first reason per
dimension) → building-baseline note when null → session facts (type, outcome,
R:R, quick checks, plan snapshot) → chart image if any.

**Rules.** Engine card data comes from the snapshot taken at analyze time (a
session's analysis is frozen history — later scores don't rewrite it).

**Acceptance.** Meters animate via `v2-reveal.js`; score chip absent from coach
text; plan-vs-record facts both visible; both themes; mobile stacks
coach-over-engine (the human word before the machine number).

---

## 2.7 (reserved — pattern detail surfaces, later phase)

## 2.8 MY PROGRESS — `/leaderboard` ✅ LIVE (rebuilt as specced)

**Purpose.** Progress, not competition-as-performance. Two clearly separated
regions:

**A. MY PROGRESS (first, private).**
- Score timeline — the `ScoreSnapshot` series as a simple sparkline/step chart
  (formula-versioned; gaps where BUILDING). Current score + delta vs 30 days ago.
- Dimension movement — which dimensions moved since last month, one line each.
- Milestones — earned (date) + next (progress bar, same logic as cockpit).
- Streak — practice label attached.
- Practice-vs-performance — sessions by type over time (LIVE/BACKTEST/STUDY mix);
  the flagship insight ("your BACKTEST discipline is 20 points above your LIVE
  discipline — the gap is the work").

**B. COMMUNITY (second, opt-in framing).**
- Carried ranking, "Ranked by discipline — not profit." ON-chain verified marks
  where they exist (verification ≠ skill). Position shown without gamified
  pressure (no "beat X trader" copy).

**Rules.** Region A is the page's primary content (top). Reputation honesty
labels everywhere. No P&L comparisons ever.

**Locked future scope (docs/VISION.md):** KAIZEN Challenges arrive here later —
14-Day Process Challenge, Risk Discipline Challenge, No Rule-Breaking Challenge,
Weekly Review Challenge — competition around process, never highest-score-wins.
Progression identities (Observer → Journaler → Process Builder → Self-Aware →
Consistent → Disciplined → KAIZEN Trader) land after the score engine proves
itself; they are development identities, never profitability claims.

**Acceptance.** Timeline renders from real snapshots (empty state for fresh
users); region separation visually unmistakable; mobile single column.

---

# 3. COACH PILLAR

## 3.1 PSYCHOLOGY — `/psychology` ✅ LIVE (rebuilt as specced)

> **The vision (owner, 13 Sep 2026):** the Psychology page is meant to be just
> like ChatGPT — in the sense that users interact with KAIZEN psychologically.
> The way users research and create with other AI agents, here they work on their
> own mind. The goal: KAIZEN knows the overall psychological state of the user,
> because most times it's not the user not following the rules — the user's
> mental state isn't stable, and that is what needs to be dealt with.

**Purpose.** A freeform, threaded conversation with KAIZEN about the trader's
mind — fears, frustration, confidence swings, focus, life stress bleeding into
trading. This is where the CAUSE gets worked on, because the rule-break is
usually the SYMPTOM. Over time KAIZEN builds a living picture of the trader's
psychological state, and that picture makes every other page smarter.

**Why it's a rebuild, not a restyle.** The current page is a single flat
exchange list (Memory docs, last 10) with a V1-era "psychology score
contribution" line. The vision requires threads, longitudinal memory, and coach
integration — a different surface.

### 3.1.1 Interaction model (ChatGPT-like, KAIZEN-native)

- **Threads.** The user starts a new conversation or continues an old one.
  Threads auto-title from the first message. Thread list = the page's landing
  state (most recent first, preview line, date). "New conversation" button.
- **Composer.** Multi-line; desktop Enter=sends / Shift+Enter=newline; mobile
  send button, Enter=newline. Sticky at bottom, above the keyboard.
- **Messages.** User bubbles (subtle surface) and KAIZEN responses (open format,
  改 mark, no bubble — reads like the coach talking). Timestamps on tap/hover.
  Typing indicator while generating.
- **Voice.** KAIZEN asks more than it lectures. Short paragraphs. Reflects back
  what it heard before advising. Names patterns it has seen in THIS user, not
  generic listicles. Ends with one good question, not five.
- **Context-aware openers** (suggested prompts above the composer, drawn from
  real state — never random):
  - ≥3 violations in last 5 sessions → "Something's been off lately. Want to talk
    about what's driving the rule breaks?"
  - Strong compliant streak → "You're protecting a good streak. What's keeping
    you steady right now?"
  - Recent loss logged with frustration language → "That last session hurt. How
    are you sitting with it today?"
  - Default set → "How's your head at today?" · "What's on your mind about your
    trading?" · "What are you avoiding looking at?"

### 3.1.2 What KAIZEN brings to the conversation (vs generic ChatGPT)

The chat is anchored in data no generic AI has:
- The user's Trading System (their actual rules — so "I broke my rules again"
  means something specific).
- Recent sessions: plan-vs-record outcomes, quick checks, dimension movement.
- The user's own recent reflections (their words, quoted back when relevant).
- The distilled state profile (below) — the memory of every prior conversation.

### 3.1.3 The state profile (longitudinal memory) — `MindState`

After each exchange, KAIZEN updates one compact, private profile per user:
- `summary` — 2–4 sentences, current overall state in plain language.
- `themes[]` — recurring patterns with first-seen/last-seen and a strength note
  (e.g. revenge-after-loss, FOMO in London open, overconfidence after wins,
  boredom trading, sleep/life stress).
- `triggers[]` — situations that reliably precede violations for this user.
- `helps[]` — what has actually worked in past conversations.

**Transparency (non-negotiable):** the profile is user-visible — a "What KAIZEN
understands about me" surface on the page, read-only. Nothing about the user's
mind is inferred silently and kept from them. Corrections happen through
conversation: the user says "that's not me anymore" and KAIZEN updates its own
understanding (D2 — the memory is permanent and self-maintaining; nothing is
deletable, by design, so the reference survives for when patterns repeat months
later).

### 3.1.4 Connection to the loop — the payoff

- `aiCoach.analyzeSession` receives the distilled MindState as context. When the
  engine reports a risk violation, the coach interprets it WITH the state:
  *"You pushed past your daily stop on Tuesday — the same afternoon pattern you
  described last week. The rule isn't the problem; the afternoon is."* Cause, not
  symptom. This is the direct productization of the owner's point.
- The coach may gently point into the psychology surface from session analysis
  ("worth taking this to a conversation") — never forcefully, never auto-opening.

### 3.1.5 Hard rules (frozen specs applied here)

1. **Psychology NEVER feeds the score.** The engine reads structural session
   signals only. MindState informs explanation, never measurement. (Test: score
   identical before/after N psych conversations — CI-testable.)
2. **No psychology score.** The V1 "psychology score contribution" is retired.
3. **Psych threads never count as sessions** — no streak, no session milestones,
   no reputation, nothing to farm. There is nothing to win here; that's the point.
   Zero gamification (owner decision D3): the V1 `psych_first` badge and the
   `psychSessions` stat are removed in this rebuild — no badge, no count, no
   scoreboard anywhere in the psychology space.
4. **Privacy.** Psych threads + MindState are the most sensitive data in the
   product: private by default; never on public profiles, leaderboard,
   reputation, or any shared surface; excluded from exports unless the user
   explicitly asks for their own copy later.
5. **Lane.** KAIZEN is a trading-psychology coach, not a therapist and not an
   emergency service. It stays in trading-performance psychology. Crisis-level
   language → a caring, human response that encourages professional help; no
   diagnosis, no clinical claims, no pretending.

### 3.1.6 Data model

- `PsychThread { userId, title, createdAt, lastMessageAt, messages:
  [{ role: 'user'|'kaizen', text, createdAt }] }` — embedded messages to start
  (split to `PsychMessage` collection only if scale demands). **Never deletable**
  (D2) — no delete routes exist.
- `MindState { userId, updatedAt, summary, themes[], triggers[], helps[],
  summaryHistory[] }` — one per user, private, **read-only to the user and
  self-maintaining** (D2): themes carry `{ name, note, status:
  active|improving|resolved, firstSeen, lastSeen, occurrences }` so improvement
  is recorded as it happens and the before-picture survives as reference.
  KAIZEN updates it after every exchange (parsed from the response contract,
  mirroring aiCoach's EXTRACTED-tail pattern); a deterministic updater serves
  fallback mode.
- **Migration:** existing `Memory{type:'psychology'}` docs seed one "Early
  conversations" thread per user (continuable — everything remains, per D2), so
  no history is lost.

### 3.1.7 Routes

- `GET /psychology` — thread list + state profile surface.
- `GET /psychology/t/:id` — one thread.
- `POST /psychology/ask` — evolves to thread-aware (threadId optional → new
  thread). Deterministic fallback responses without an API key (same honesty
  rule as aiCoach — never blank, never fake-deep).

### 3.1.8 Acceptance criteria

- Thread list → open thread → send → response appears → persists across visits.
- Openers reflect the user's actual recent state (violation streak vs good
  streak vs default — three codepath tests).
- MindState visible + correctable by the user; used in aiCoach context
  (integration test: coach response references a seeded theme).
- Engine score provably unchanged by psych conversations.
- No psych content on any public/reputation surface (grep-level guarantee).
- Crisis-language path returns the care response.
- Mobile: full-height chat, sticky composer, keyboard-aware scroll, one-handed
  use. Both themes. Reduced-motion safe.

---

## 3.2 KAIZEN AI — `/kaizen-ai` ✅ LIVE (rebuilt as specced)

**Purpose.** The same conversational quality as Psychology, aimed at the TRADES:
"was this entry valid per my system?", "review this chart screenshot", "what
should my invalidation be on this setup?", "quiz me on my own rules".

**Relationship to Psychology (one line each):** KAIZEN AI is the ChatGPT for the
trading side; Psychology is the ChatGPT for the mind. Same conversation
infrastructure (threads, composer, openers), different context: system + sessions
+ chart vs system + sessions + MindState.

**Specifics.**
- Threads (same model; type `trading` vs `psychology` distinguishes them).
- Chart image attachable to a message (vision-capable model when configured;
  text-describe fallback otherwise).
- "Quiz me on my rules" — generated from the user's actual Trading System.
- Responses quote the user's own rules back (rule references in mono gold).
- Suggested openers: after a session with failed quick checks → "Want to review
  today's entry against your rules?"; after a system version bump → "Your rules
  changed — want to pressure-test the new version?"

**Rules.** Same hard rules as Psychology (never scores, never counts as
sessions, private). Session-analysis responses (from the Reflect chain) remain
in Sessions + Memories — this page is conversation, not the analysis archive.

**Acceptance.** Threads work; image attach works; quiz uses real system data;
both pages share one chat component family (consistent mobile behavior).

---

## 3.3 MEMORIES — `/memories` 🔁 CARRIED → restyle

**Purpose.** The archive: everything KAIZEN has ever said to this user — session
analyses, psychology responses, trading-chat responses — searchable, ownable.

**Layout.** Filter chips (All · Session analyses · Psychology · Trading chat) →
chronological cards (date, context line, full text, thread/session link) →
search box (client-side to start; server-side when volume demands).

**Rules.** Read-only archive (never-delete applies). Psychology entries visible
only to their owner (already true — private by design). No score lines anywhere
in archived V2 content (V1 archive may contain old "DISCIPLINE SCORE" lines —
left as historical record, clearly V1-dated).

**Acceptance.** Filters work; every entry links to its source (session/thread);
mobile cards comfortable; both themes.

---

# 4. TOOLS PILLAR

## 4.1 CHART — `/chart` 🔁 CARRIED (kept)

**Purpose.** The TradingView tool, kept. Drawings/annotations are stored
chart-agnostically (B8) so the future KAIZEN Chart Engine (the owner's strategic
project — its own phase, backtest/replay as its natural first milestone) slots
in without migration.

**V2 deltas only.** Terminology pass (AppCopy renames), nav grouping under
Tools, session-linking: from a Record page "open chart for this asset" (asset
pre-filled). No functional rebuild in this phase.

## 4.2 WEEKLY REPORT — `/weekly-summary` ✅ LIVE (rewired as specced)

**Purpose.** "Your week in one honest page" — the week's sessions, score
movement, and a short coach's letter.

**V2 rewiring (data sources change, layout light).**
- Score movement: `ScoreSnapshot` series this week vs last (delta per dimension,
  overall delta). Building-state honesty when insufficient evidence.
- Sessions: count by type (LIVE/BACKTEST/STUDY), completion of the loop
  (planned→recorded→reflected), quick-check compliance rate.
- The coach's letter: generated summary (aiCoach prompt, weekly variant) —
  references the week's actual pattern + MindState context (psych integration).
  No score line, no performance claims.
- Milestone movement this week; streak status.

**Acceptance.** Works for a week with zero sessions (honest empty state: "No
sessions this week. The record notices — without judging."); deltas computed
from snapshots, not recomputed ad-hoc; both themes.

## 4.3 MARKET NEWS — `/news` 🔁 CARRIED (kept)

Kept as-is (external feed), terminology pass + Tools grouping only. Explicitly
NOT KAIZEN analysis — labeled "market data, not advice."

---

# 5. IDENTITY PILLAR — WALLETS & VERIFICATION — `/za/reputation/:id` 🔁 CARRIED

**Purpose.** One page (per App.js): connected wallets (private by default),
credentials + Mantle records (testnet clearly labeled), optional ZA reputation
and its bounties. No blockchain jargon in the UI.

**V2 deltas.** Nav label "Wallets & Verification"; bounties reachable from here
(not top-level nav); reputation labeled as verification evidence — never skill,
never trading performance. Carried V1 functionality otherwise; rebuild deferred
with the Trader Profile phase.

**Locked roadmap anchors (docs/VISION.md):**
- The **evidence ladder** frames this page: L1 self-reported → L2
  KAIZEN-observed → L3 externally verified → L4 real-capital history. The page
  communicates which rungs a trader stands on; the score already separates
  declared vs extracted evidence (evidenceMix).
- **One universal wallet interface** over time — Stacks now, EVM and other
  networks later; private by default always.
- **Mantle records credentials; it never calculates anything.**
- Stage 4 **credential names**: Process Discipline, Risk Management,
  Consistency, Improvement, Rule Adherence, Long-Term Development — each states
  what was demonstrated and the evidence behind it. Never a profitability claim.
- Token ownership can never raise reputation (if a token ever exists).

---

# 6. SETTINGS PILLAR

## 6.1 MY TRADING SYSTEM — `/settings/trading-system` ✅ LIVE

**Purpose.** "Your rules, evolved." The versioned rules object every session is
measured against.

**Layout.** Head (eyebrow `SETTINGS · 改`, purpose line, version chip vN +
versions-on-record) → saved note (after save) → form grid:
- **Identity** — system name, market conditions.
- **Your edge** — setups (one per line; become plan-stage dropdown), entry
  rules, exit rules.
- **Risk rules** — risk/trade, max trades/day, daily drawdown, max position
  (hard numbers; "the engine reads these — breaking them is what moves Risk").
- **Discipline** — trading hours, no-trade conditions, psychological rules.
- **Positions** — sizing/management.
- **Save card** — change note (optional) + "Save as new version" + back link.

**Logic.** `ensureForUser` lazy-migrates V1 `User.tradingStyle` on first visit;
every save = `saveAsNewVersion` (version++, snapshot into history, change note).
History never overwritten; sessions stay judged by the rules of their time
(`plan.systemVersion`).

**Rules.** Version history viewer = later phase (this page records it now).
Legacy `/settings/trading-style` redirects (POST → 307).

**Acceptance.** First visit by a V1 user shows migrated rules, version 1; saving
bumps to v2 with note; setups appear in the Plan dropdown immediately; risk
numbers flow to the engine (`system.riskRules.maxDailyTrades` drives the cadence
guard); mobile single column (field rows collapse); both themes.

---

# 7. AUTH

## 7.1 LOGIN — `/auth/login` ✅ LIVE (light restyle)

Google sign-in + email/password; V2 voice only ("Your improvement record is
waiting." · "改善 · Improvement, every day"). Errors inline. Logged-in users
redirect to Cockpit. No dark patterns, no upsell.

## 7.2 REGISTER / ONBOARDING — `/auth/register` ✅ LIVE (rebuilt)

**The journey made real: JOIN → RULES → PLAN → LOG** (stepstrip visible on both
steps).

- **JOIN** — account creation (Google or email; referral `?ref=` honored). PRG
  into RULES.
- **RULES** — guided first Trading System: market + hours, setups, one entry
  rule, hard risk numbers ("the engine reads these"). Saved as version 1 →
  redirect to PLAN. "You can refine later — every save is a new version."
  **Honest skip**: blank system v1, straight to Cockpit, which nudges when it
  matters.
- **PLAN** — landing on `/dashboard/sessions/new`: the loop's first run.
- **LOG** — the loop they now live in.

Legacy `POST /auth/onboarding` (old 5-question flow) redirects to RULES;
verify-otp stub kept for compatibility.

**Acceptance.** Full journey JOIN→RULES→PLAN works E2E; skip path lands on
Cockpit with a blank-but-real system v1; journey strip accurate on both steps;
error states inline; mobile keyboard flow (Enter advances); both themes.

---

# 8. PUBLIC PAGES — approved in the public phase (`4b18555`)

Home, About, Services, Terms, Help, Support, Preview index. Terminology already
V2. `/about#kaizen-score` carries the public "How is this scored?" explanation
(the Cockpit links here). No changes in this phase.

## 8.1 WHITEPAPER — `/whitepaper` ✅ LIVE (v1.0, 16 Sep 2026)

The standard long-form project document, on-site (both themes, mobile-first).
Eight sections: The Problem (knowledge is not the bottleneck) → The Method
(the Improvement Loop; LIVE/BACKTEST/STUDY; your own rules are the ruler) →
The KAIZEN Score (five dimensions; engine measures, AI explains; process
never P&L; silence never counted; honesty never punished) → The Mind
(psychology is the root, behavior is the symptom; permanent memory; **psychology
never feeds the score** — privacy + measurability, stated openly) → Evidence
(what is recorded on-chain vs never recorded; reputation as evidence) → Who
KAIZEN Is For → What KAIZEN Is Not (no signals, no copy trading, no profit
promise) → The Road Ahead (Improve. Prove. Build Reputation. Unlock
Opportunity.). Linked from navbar (both states) + footer. D1-safe: no
integrity mechanics, no "can't be gamed", no profitability promises, no
eight-stage internals.

---

# 9. OWNER DECISIONS

- **D1 — New-user intro: YES, without the armor** *(decided 13 Sep 2026)*.
  Brand-new users (no V1 history) get a one-time "How your KAIZEN Score works"
  intro: the five dimensions, WHY, the Building honesty. It does NOT mention
  that the system can't be gamed — the owner's call, and the right one:
  advertising the armor teaches attackers what to avoid, and reads as an
  accusation to honest users. See global rule 9. Pending build (Cockpit modal
  + the `/about#kaizen-score` section).
- **D2 — KAIZEN's memory is permanent and self-maintaining** *(decided 13 Sep
  2026)*. Nothing psychological is deletable — conversations and the MindState
  stay forever as longitudinal reference, so when a pattern repeats months later
  KAIZEN recognizes it. The user never edits or updates the profile: KAIZEN
  updates its own understanding after every exchange, recording improvement as
  it happens (themes evolve active → improving → resolved, with first/last
  seen). Correction happens through conversation, not an edit UI. The profile
  remains user-visible (read-only) — transparency is the product's soul.
- **D3 — Psychology gamification: ZERO** *(decided 13 Sep 2026)*. No badges, no
  counts, no scoreboard in the psychology space — the one room with nothing to
  earn. The V1 `psych_first` badge and `psychSessions` stat are removed in the
  Psychology rebuild.
- **D4 — Build order** *(decided 13 Sep 2026)*: **Psychology → KAIZEN AI →
  My Progress → Weekly Report.** Psychology is next (flagship vision); KAIZEN AI
  follows immediately (shares the chat machinery); then My Progress; then the
  Weekly Report rewire.

---

*Spec status: complete for all surfaces. Psychology §3.1 is the owner's 13 Sep
2026 vision, specced for build. All four owner decisions locked (D1–D4 above).
Terms of Service signal-list trimmed per rule 9. Nothing merges to `main` until
the owner's final review.*
