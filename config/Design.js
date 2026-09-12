KAIZEN V2 — VISUAL DESIGN SPECIFICATION (STEP 4)

The presentation layer for the approved Step 3 copy (config/Copy.js), designed
after the frozen story and structure. Per the protocol:

Story first → structure second → visual design third → code last.

Direction concept mockups (AI-generated, for DIRECTION only — not pixel
mockups; final UI is built in code). EVERY MOCKUP EXISTS IN BOTH THEMES
(dark default + light) — a design is not approved until it has been seen
in both, because the product ships with a theme toggle (frozen 14 Sep
2026). Contact sheets: dark in the files below, light in
all-light-theme.jpg.
  design/mockups/01-welcome-hero.jpg / -light.jpg   — hero with score dial
  design/mockups/02-score-dial.jpg / -light.jpg     — the signature score component
  design/mockups/03-improvement-loop.jpg / -light.jpg — the five-step loop section
  design/mockups/04-verification.jpg / -light.jpg   — Identity & Verification section


================================================================================
1. DESIGN DIRECTION — "THE DISCIPLINED DOJO"
================================================================================

EVOLVE, NOT REBRAND.

The reset was never about new colors. The existing identity — near-black,
gold, DM Mono, sharp corners, the 改 watermark — already says "discipline."
It is kept. What's missing is DEPTH, RHYTHM, and SIGNATURE MOMENTS.

The problem with the current site is not that it looks wrong. It's that
everything sits on the same flat plane: near-identical surfaces
(#080808 / #111 / #1616), identical card stacks in every section, numbers
displayed as text instead of instruments, one accent color doing all jobs,
and zero motion. Disciplined, but monotone. That is what "too plain" means
here.

The fix, in one line:

> Gold is the story of improvement. Vermillion is the story of proof.
> Everything else stays quiet and lets them speak.

Three moves:

MOVE 1 — INSTRUMENTS, NOT NUMBERS.
The KAIZEN Score stops being a number in a card and becomes a DIAL — a
thin gold ensō-like arc with the five dimensions as meters beside it.
Scores, streaks, and dimensions are always drawn as instruments. This is
the single biggest visual upgrade and becomes the brand's signature
component. (Mockup 02)

MOVE 2 — A SECOND ACCENT WITH ONE JOB.
Introduce vermillion (traditional Japanese seal red, ~#C0392B) used ONLY
for verification and credential moments — the hanko stamp concept. In
Japan, a seal certifies; it is the natural visual metaphor for "verified."
Gold keeps every other accent job. Two colors, two meanings, never mixed.
(Mockup 04)

MOVE 3 — DEPTH AND RHYTHM.
Separate the surface levels so the eye can feel elevation; add a faint
background grid (graph-paper / market-chart texture) to hero sections;
give each page a section rhythm that alternates density (statement →
instrument → proof) instead of repeating card stacks; add restrained
motion so the page responds to the visitor.


================================================================================
2. WHAT STAYS / WHAT CHANGES
================================================================================

STAYS (the brand spine):
- Near-black base + warm off-white text
- Gold #C9A84C as the primary accent
- DM Mono for eyebrows/labels/metrics, Outfit for body and headlines
- Sharp corners, 1px hairline borders — no rounded corners, ever
- Feather icons (thin line set)
- The 改 KAIZEN watermark (formalized, see §6)
- Dark default with full light-theme parity
- The existing hero headline structure (it already works)

CHANGES (the upgrades):
- Surface levels re-separated for real depth (§5)
- Score → dial component everywhere a score appears (§7.1)
- Vermillion added for verification moments only (§4)
- Background grid texture on hero/feature sections (§5)
- Section rhythm per page — no more monotonous card stacks (§8)
- Scroll-reveal motion, dial draw-in animation (§9)
- Eyebrow style standardized: gold tick + tracked-out mono uppercase
- Inline-style pages (about/services) migrate to shared classes
- Legal pages get a readable two-column structure (§8.5)
- Generic AI iconography (cpu/brain/sparkle) replaced by the 改 kanji
  mark everywhere the engine is referenced (§7.9)


================================================================================
3. DESIGN PRINCIPLES (mapped to product principles)
================================================================================

P1 — CALM LIKE A DOJO, PRECISE LIKE A TERMINAL.
The product asks traders to be disciplined. The design must model that:
generous whitespace, low visual noise, precise hairlines, no decoration
without meaning.

P2 — IMPROVEMENT IS VISIBLE.
Anything that improves over time is drawn as an instrument (dial, meter,
sparkline, streak flame). Never bury progress in text.

P3 — PROOF IS SEALED.
Anything verified gets the vermillion seal treatment. If it isn't
verified, it never wears vermillion. Users learn the color means
something — which is exactly why the honesty rules survive visually.

P4 — QUIET UNTIL IT MATTERS.
90% of the canvas is neutral. Gold and vermillion are spent sparingly,
so when they appear, they land.

P5 — MOTION IS EARNED, NOT DECORATIVE.
Animation exists to show relationship and change (a dial filling, a step
connecting, a pattern appearing), never for entertainment.


================================================================================
4. COLOR SYSTEM (UPDATED TOKENS)
================================================================================

DARK (default)                              LIGHT
--bg-base:     #080808  (unchanged)         #F5F3EF
--bg-card:     #101010  (was #111)          #FFFFFF
--bg-elevated: #181818  (NEW level)         #FAF8F5
--bg-surface:  #161616  (was, now 4th)      #F0EDE8

--gold:        #C9A84C  (unchanged)         #B8960C
--gold-light:  #E2C46A  (unchanged)         —
--vermillion:  #C0392B  (NEW)               #A93226
--vermillion-pale: rgba(192,57,43,0.08)     (NEW)
--vermillion-border: rgba(192,57,43,0.30)   (NEW)

--blue:        #3B82F6  — DEMOTED. Blue becomes a plain utility color
(for external links and informational states only). It no longer carries
a brand job. Chain-branded cards (Stacks/Mantle) no longer use blue as a
"brand" — verification is vermillion's job now.

--text-primary:   #F5F3EF                  #1B1B1B
--text-secondary: #A8A09A                  #5B5550
--text-faint:     #6B655F  (NEW)           #8A847E
--border:         rgba(255,255,255,0.07)   rgba(0,0,0,0.10)
--border-strong:  rgba(255,255,255,0.14)   (NEW)

Semantic: --green #34D399 (positive/improving), --red #F87171 (negative/
declining) — used only in data contexts (pattern chips, deltas), never
decoratively.

RULES OF USE:
- Gold: actions, eyebrows, headlines' accent words, active states, dials.
- Vermillion: ONLY on verification/credential elements — the seal icon,
  "VERIFIED" chips, credential cards, the [VERIFY] affordance.
- Green/Red: only as data deltas (e.g. "Friday compliance −18%").
- Never two accent colors in the same component unless one is semantic data.

GOLD TEXT RULE (owner, 15 Sep 2026 — both themes, frozen):
Gold text belongs to the BRAND and to DATA. Everything else speaks in
the page's reading color.

GOLD TEXT (dark: #C9A84C · light: #B8960C):
- The logo mark and wordmark (改 KAIZEN — navbar, footer, anywhere)
- The word "KAIZEN" inside titles ("About KAIZEN") — one accent word max
- Eyebrows / section kickers / group labels (mono, tracked)
- The kanji 改 badge and 改-prefixed engine labels
- Instrument values: dial numbers, meter fills, metric figures
- Active nav item, hover accents, links on hover

READING COLOR (dark: #F5F3EF · light: near-black #1B1B1B):
- Headlines (except the single accent word), all body copy,
  descriptions, form inputs, table text, legal text

NEVER GOLD: paragraphs, full sentences, buttons' body labels except
primary actions. If a sentence is gold, it is wrong.
Rationale: gold = brand + data + accent; black/white = language.
The existing pages and mockups already follow this; it is now a frozen
rule so it can never drift.


================================================================================
5. DEPTH & TEXTURE SYSTEM
================================================================================

ELEVATION LEVELS (dark theme values; light mirrors them):
L0  page base         #080808   no border
L1  card              #101010   1px var(--border)
L2  elevated card     #181818   1px var(--border-strong),
                                 inset 0 1px 0 rgba(255,255,255,0.04),
                                 0 8px 24px rgba(0,0,0,0.4)
L3  feature panel     #181818   1px var(--gold-border),
                                 inset top highlight, gold glow at 6%

L1 vs L0 must be visible; L2 must float. Cards lift to L2 on hover
(translateY(-2px), shadow grows, 200ms ease-out).

BACKGROUND GRID (hero + feature sections only):
  background-image:
    linear-gradient(rgba(245,243,239,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(245,243,239,0.015) 1px, transparent 1px);
  background-size: 48px 48px;
Plus a radial mask so the grid fades toward the section edges. This gives
the "market chart" texture without noise. (Visible in mockups 01, 03.)

GLOWS: existing gold glows kept but restrained — hero only, one per page.


================================================================================
6. TYPOGRAPHY SCALE
================================================================================

Fonts unchanged: Outfit (display/body) + DM Mono (labels/metrics).
What changes is the SCALE and CONTRAST — current headings are timid.

DISPLAY (hero)     clamp(2.8rem, 6vw, 5.5rem) / 700 / 1.05 / -0.02em
H2 SECTION         clamp(1.8rem, 4vw, 3rem)   / 700 / 1.1
H3 CARD            1.0–1.1rem                 / 700
BODY LARGE         1.10rem / 400 / 1.85  (hero subs)
BODY               0.95rem / 400 / 1.75
BODY SMALL         0.85rem / 400 / 1.7   (card descriptions)
EYEBROW            0.68rem / 500 / 0.2em tracking / mono / uppercase / gold
METRIC LABEL       0.60rem / 500 / 0.15em tracking / mono / uppercase / faint
METRIC VALUE       1.6–2.4rem / 700 / tabular figures

RULE: headlines are Outfit; every number a user should track is DM Mono
with font-variant-numeric: tabular-nums. Numbers always mono. No exceptions.

EYEBROW STANDARD (one pattern, everywhere):
  [— 24px gold rule]  LABEL TEXT  [— 24px gold rule, centered variants]
  mono, uppercase, gold, tracked. This replaces the current mix of icon-led
  and rule-led eyebrows.


================================================================================
7. SIGNATURE COMPONENTS
================================================================================

7.1 THE KAIZEN DIAL (THE brand component)
A circular SVG gauge: thin track ring (border color), gold arc
(stroke-dasharray animated to value), large mono number centered,
"KAIZEN SCORE" mono label beneath. Optional tick marks at 0/25/50/75/100.
Variants: lg (hero/product preview, 220px), md (profile cards, 96px),
sm inline (stat rows, 40px). The dial fills on scroll-into-view (600ms
ease-out). Dimensions render as a five-meter row beside it (mockup 02).
Every score in the entire product renders as a dial from now on.

7.2 DIMENSION METERS
Five rows: mono label left, thin 2px track with gold fill, mono value
right. Fill animates to width. Used beside dials, in services, and in the
future dashboard. (Mockups 01, 02.)

7.3 THE SEAL (hanko mark)
A circular vermillion outline seal containing a small glyph (✓-style mark
or 認). Used at: "Verified" chips, credential cards, the VERIFY affordance,
footer of the Trader Card (later). One seal per card maximum. Text always
pairs with it — the seal decorates proof, never replaces it. (Mockup 04.)

7.4 PATTERN CHIPS
The pattern-detection list items, standardized: hairline-bordered chip,
feather icon 13px, mono text, colored left tick — red tick = warning,
green tick = improving, gold tick = watch. Stagger-reveal 60ms apart.

7.5 LOOP STRIP
The core loop as a persistent navigational motif:
  PLAN → TRADE → REFLECT → ANALYZE → IMPROVE → REPEAT
mono, tracked, gold arrows, faint text — rendered under section titles
(mockup 03) and reused in-app later (journal, dashboard) as the product's
wayfinding signature.

7.6 STEP CARDS (How It Works)
Five cards, hairline borders, ghost numbers (01–05, 3rem, 8% white),
title, two-line description, connected by a 1px gold line with small
chevron nodes. Icons: steps 01/02/04/05 use feather line icons; the
featured step 03 (KAIZEN AI Responds) carries the gold border and its
icon is the 改 KANJI BADGE (§7.9) — never a generic AI symbol.
Desktop: single row of five; tablet: 3+2; mobile: vertical stack with a
left connector line. (Mockup 03, corrected: 改 on the featured card.)

7.7 BUTTONS
.btn-primary  gold fill, #080808 text, hover: gold-light + glow, active
              pressed. Padding 16px 40px. NO radius.
.btn-outline  1px border-strong, text-primary, hover: gold border + gold
              text. NO radius.
.btn-seal     vermillion outline variant — used ONLY for verification
              actions ("Verify Profile", later).
Link style: gold underline on hover, 150ms.

7.8 SECTION HEADER BLOCK
One pattern page-wide:
  EYEBROW (§6 standard)
  H2 (Outfit, one accent word in gold where the copy allows)
  SUB (body-large, max-width 560px, centered or left)
  [LOOP STRIP where relevant]

7.9 THE KANJI MARK (改) — THE ENGINE'S SIGNATURE
The 改 glyph is KAIZEN's brand mark — and specifically the mark of the
KAIZEN engine itself. Wherever the product references its AI/analysis
(the How-It-Works step, the AI response card, "KAIZEN AI Responds"
features), the icon is the kanji: gold glyph, serif CJK font, inside a
hairline-bordered square badge.

NEVER use generic AI iconography — no chips, brains, sparkles, or
"circuit" marks. Those read as every other AI product. The kanji says
something no other product can: you are not talking to a generic AI,
you are talking to KAIZEN.

RULES:
- One kanji badge per card/component. It is a signature, not wallpaper.
- The kanji is gold on dark themes (vermillion only if the card itself
  is a verification context, which an AI card never is).
- Rendered as text (font-family with CJK fallbacks) — crisp at any size.


================================================================================
8. PAGE STRUCTURES (WIREFRAME ORDER — matches approved copy)
================================================================================

8.1 WELCOME
  1  NAVBAR
  2  HERO — grid texture, headline (problem-first), sub (identity line),
     CTAs; RIGHT: dial+dimensions instrument panel (mockup 01). The
     instrument panel is NEW — replaces nothing, adds the signature.
     Trust row beneath, 4 items, mono labels.
  3  PRODUCT PREVIEW — three cards (Score dial sm, AI response, pattern
     chips) on L2 surfaces. AI response card is the featured L3 and
     carries the 改 kanji badge (§7.9), not a cpu/brain icon.
  4  HOW IT WORKS — loop strip + five step cards (mockup 03).
  5  WHAT KAIZEN TRACKS — two-column: left statement+CTA, right list of
     four track items. (Fifth blockchain item removed per audit.)
  6  WHO KAIZEN IS FOR — four audience cards (beginner added), featured
     card = Consistent Trader.
  7  FINAL CTA — gold glow, headline "Your discipline is your edge.",
     buttons.
  8  FOOTER (+About link)

8.2 ABOUT
  1  NAVBAR
  2  HEADER — eyebrow "The Mission", title, sub. Grid texture.
  3  THE PROBLEM — single wide statement panel, red-tinted edge,
     softened stat.
  4  THE SOLUTION — statement + body; right rail: dial illustration.
  5  WHAT MAKES KAIZEN DIFFERENT — four pillars (AI/Signals,
     Psychology, Progress You Can Prove, Real Experience). Pillar 3 gets
     a small seal motif (proof theme).
  6  IDENTITY & VERIFICATION — three cards per mockup 04. Middle card
     (Credentials) featured with gold border + seal + "TESTNET" mono tag.
     No explorer links.
  7  MISSION QUOTE — centered blockquote panel.
  8  CTA — "Start Building Your Improvement Record".
  9  FOOTER

8.3 SERVICES
  1  NAVBAR
  2  HEADER — "What KAIZEN Gives You".
  3  THE IMPROVEMENT ENGINE — four feature cards; "Your Trading System"
     leads as the featured L3 card.
  4  YOUR PROGRESS — four cards; "KAIZEN Score" card carries a small
     dial + five meters (the component advertised, shown).
  5  TOOLS — two-card row (Charting; Weekly Summary). Market News
     removed from public list.
  6  IDENTITY & VERIFICATION (OPTIONAL) — same three-card pattern as
     About 8.2.6 for consistency.
  7  COMING SOON — five muted cards (Trader Profile, Trader Card, Voice,
     Mobile, Pro). Trader Card card shows the seal at low opacity.
  8  FINAL CTA.
  9  FOOTER

8.4 TERMS
  Legal layout, standardized:
  - Sticky in-page TOC rail (desktop left column, numbers only) — the 17
    sections are long; navigation is a readability feature.
  - Single reading column max-width 720px.
  - Section numbers in gold mono. H3s Outfit.
  - §3 (Not Financial Advice) and §8 (Score & Verification) get a
    vermillion left-border callout — the two sections that protect the
    user and the business.
  - "Last updated: September 2026".

8.5 PRIVACY
  Same legal layout as Terms. The wallet-data subsection gets a small
  lock glyph. §9 Cookies fixed content per approved copy.

8.6 SHARED
  FOOTER: logo · Privacy · Terms · About · Help Center · Support · © 2026.
  NAVBAR: unchanged structure this phase; strings renamed where they say
  "Discipline Score".


================================================================================
9. MOTION SYSTEM
================================================================================

DURATIONS: micro 150ms · standard 250ms · reveal 400ms · dial 600ms.
EASING: ease-out everywhere; never bounce, never elastic.

SCROLL REVEALS: sections' children fade-up 12px, 400ms, staggered 60ms,
once per page load (no re-triggering). Implemented with IntersectionObserver.

DIAL: stroke-dashoffset animates from empty to value on first view.
METERS: width animates 400ms after their section reveals.
HOVERS: cards lift (L1→L2) 200ms; buttons brighten 150ms; nav underline.
PATTERN CHIPS: stagger in 60ms apart.
HERO: the instrument panel's dial draws in once, 800ms after load —
the "instrument wakes up" moment. One animation per hero, no loops.

REDUCED MOTION: prefers-reduced-motion: reduce → all reveals/motion off,
dial renders final state immediately. Non-negotiable accessibility rule.

PERFORMANCE: no animation libraries. CSS transitions + one Intersection-
Observer + SVG dashoffset. Total motion JS budget: <1KB inline.


================================================================================
10. ACCESSIBILITY
================================================================================

- Text contrast: gold on #080808 measured at ~7:1 (passes AAA for the
  sizes used); text-secondary ~7:1; text-faint used only for ≥0.6rem
  mono labels and passes AA at their sizes. Verify every token pair in
  code with a contrast check before shipping.
- Focus states: 2px gold outline offset 2px on all interactive elements.
- Icon-only buttons carry aria-labels.
- Dials carry aria-valuenow/min/max + a visually-hidden text equivalent
  ("KAIZEN Score 76 of 100").
- Light theme: all components implement both themes from day one —
  no dark-only components ship.
- Feather icons are decorative → aria-hidden; meaning lives in text.


================================================================================
11. IMPLEMENTATION NOTES (FOR STEP 5 — NOT YET CODE)
================================================================================

- New tokens added to style.css :root and [data-theme="light"]; old
  surface values shift once (bg-card #111→#101010) — check all in-app
  pages that use surfaces for visual regressions.
- The dial is a small inline-SVG partial (views/partials/score-dial.ejs)
  taking value + size; reusable across public pages now and the app
  later. Same for meters and pattern chips.
- Welcome/about/services migrate from inline styles to shared classes
  (.k-section, .k-card, .k-eyebrow, .k-dial, .k-meter, .k-chip...) so
  Step 5+ in-app rebuilds inherit the system.
- No new dependencies. No fonts beyond the two. No JS frameworks.
- The grid texture and reveals are progressive enhancement — pages are
  fully readable with JS off and prefers-reduced-motion on.

================================================================================
NEXT STEP
================================================================================

Step 5 — CODE. Build the five pages with the approved copy (config/Copy.js)
under this design system, in this order:
  1. Tokens + shared partials (dial, meters, chips, section header)
  2. welcome.ejs
  3. about.ejs + services.ejs
  4. terms.ejs + privacy.ejs
  5. Footer/navbar string updates
Review of the direction in this document (and the four mockups) is the
gate. On approval, code begins.
