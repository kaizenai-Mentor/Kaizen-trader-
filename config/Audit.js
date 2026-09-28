KAIZEN V2 — PUBLIC PAGES AUDIT (STEP 2)

This is the section-by-section audit of the five public pages against the frozen V2 definition (config/New.js + config/Start.js), performed before any rewriting, per the agreed working protocol:

Story first → structure second → visual design third → code last.

Every section below gets one verdict:

KEEP — already aligned with the frozen definition
CHANGE — right idea, wrong framing; rewrite
REMOVE — contradicts the frozen definition; delete
ADD — required by the frozen definition; missing today


================================================================================
THE FROZEN STANDARD (what we audit against)
================================================================================

KAIZEN IS:
> A trader improvement and reputation platform that turns trading behavior
> into measurable progress and verifiable credentials.

CORE LOOP:
PLAN → TRADE → REFLECT → ANALYZE → IMPROVE → REPEAT

FIVE SCORE DIMENSIONS (canonical, no other list):
1. Process
2. Risk
3. Execution
4. Behavior
5. Learning & Consistency

BLOCKCHAIN ROLES (frozen):
Stacks  → wallet/identity infrastructure (one option among several)
Mantle  → credential records (KAIZEN calculates off-chain; Mantle only records)
ZA DAO  → optional external Web3 reputation, never mandatory, never in the score

LEADERBOARD:
No traditional "highest score" leaderboard. Optional behavioral challenges
later. Default experience is My Progress (you vs your past self).

VERIFICATION HONESTY:
Wallet ownership ≠ trading performance. A high score is never a promise of
profitability. Be explicit about what is and isn't verified.

GAMIFICATION PRINCIPLE:
Reward better decisions, not more trading.

COPY PRINCIPLES (from owner, 10 Sep 2026):
- Every public page must answer: What is KAIZEN? Who is it for? How does it help?
- Bait, not confusion: show enough to create curiosity, never enough to overwhelm.
  Depth lives inside the app.
- Written for both beginners and experienced traders — written to HELP, not to impress.
- "Discipline Score" is retired everywhere → "KAIZEN Score."
- Business is Nigerian, audience is global. Legal pages stay honest, no invented claims.


================================================================================
FACT-CHECK RESULTS (claims vs actual code)
================================================================================

Before judging the copy, each factual claim was checked against the codebase:

CLAIM                                          REALITY
Google OAuth login exists                      TRUE  (passport + GoogleStrategy in server.js)
"20 badges" on Services page                   TRUE  (config/badges.js has 20)
Weekly + all-time leaderboard                  TRUE  (views/leaderboard.ejs has both tabs)
"Psychology engagement contributes 30%         FALSE (dashboardController: score =
 to your overall Discipline Score"                    compliant journals / total journals × 100.
                                                      No psychology weighting exists anywhere)
Mantle explorer links                          Point to Sepolia TESTNET
Privacy §9 "Cookies and Session Data"          BUG — contains a duplicate of §10
                                                    (International Data Transfers) text.
                                                    No actual cookie/session info exists
Wallet verification (Stacks)                   EXISTS in code (routes/wallet.js, encrypted
                                                    addresses, hashed nonces, consent records)
                                                    but is NOT covered in Terms or Privacy

The 30% claim, the testnet links, the privacy bug, and the missing wallet-privacy
section all get fixed in this reset regardless of anything else.


================================================================================
PAGE 1 — welcome.ejs
================================================================================

1.1 Title tag: "KAIZEN - Trade Better. Every Day."
VERDICT: KEEP
Already the right idea. Improvement, daily. No change needed.

1.2 Live badge: "Now Live · Powered by Zero Authority DAO & Mantle"
VERDICT: CHANGE
Blockchain is in the first thing a visitor sees. Frozen rule: the user doesn't
need to care about blockchain to use KAIZEN. Replace with something about the
product, e.g. "Now Live · Free to Start" or simply remove the badge.
RESOLVED 18 Sep 2026: badge removed from the hero entirely (owner decision).

1.3 Hero headline: "Most traders know their rules. Few follow them."
VERDICT: KEEP
The strongest line on the entire site. It is exactly the frozen problem
statement: "Traders often know what they should do but struggle to
consistently do it." Do not lose this line.

1.4 Hero sub: "KAIZEN is an AI trading discipline mentor that analyzes your
sessions, learns your behavioral patterns, and holds you accountable..."
VERDICT: CHANGE
Currently defines KAIZEN as an AI mentor. The frozen definition is a trader
improvement and reputation platform. Rewrite to answer "What is KAIZEN?" with
the frozen one-liner while keeping the mentor personality as the HOW, not the
WHAT. Fold in the identity line from the blueprint —
"Become the trader you can prove you're becoming."

1.5 Hero sub2: "Not a signal app. Not a copy-trading platform..."
VERDICT: KEEP
Good differentiation, honest tone. Keep as is.

1.6 CTAs: "Start Today" / "See How It Works"
VERDICT: KEEP (minor)
Consider "Start Improving" to echo the blueprint hero, but this is cosmetic.

1.7 Trust row: AI-Powered Analysis / Dual On-Chain Reputation / Discipline
Score Tracking / 100% Free to Start
VERDICT: CHANGE
- "Dual On-Chain Reputation" → REMOVE from hero. Replace with an
  improvement-focused item (e.g. "Behavioral Pattern Detection").
- "Discipline Score Tracking" → "KAIZEN Score Tracking" (rename, everywhere).

1.8 Product preview section ("Inside KAIZEN" — score card, AI response card,
pattern detection card)
VERDICT: KEEP (the best section on the page)
This is exactly "bait, not confusion": concrete, specific, real-looking.
- Rename "Discipline Score" → "KAIZEN Score" on the score card and inside the
  AI response preview ("DISCIPLINE SCORE: 61%" → "KAIZEN SCORE: 61").
- "Measures process compliance - not profit" — keep, it's the honesty rule.
- The EURUSD/MSS example is advanced but it's an example, not a lesson.
  Acceptable for a both-audiences page.

1.9 How It Works: "Your discipline journey in four steps"
(Define Your Rules → Log Every Session → KAIZEN AI Responds → Track Your Growth)
VERDICT: CHANGE
The steps exist but don't match the frozen core loop, and step 4 currently
ends with "Earn verifiable on-chain reputation through ZA DAO" — which puts
ZA in the payoff position of the whole journey. Frozen rule: ZA is optional
and external. Rewrite the four steps to mirror
PLAN → TRADE → REFLECT → ANALYZE → IMPROVE, ending on the score and
improvement, not on a DAO. Credentials may appear as the *later* consequence.

1.10 "What KAIZEN AI Tracks" — Rule Compliance / Emotional Triggers /
Technical Execution Quality / Discipline Score Progression / On-Chain
Reputation via ZA DAO & Mantle
VERDICT: KEEP the section, REMOVE the fifth item
First four items are the Behavioral Intelligence phase, keep them (rename the
score item). The fifth item ("On-Chain Reputation via ZA DAO & Mantle") is
infrastructure, not something the AI tracks — remove it from this list.
"Patterns your P&L will never show. Only your journal can reveal them."
is an excellent line. Keep.

1.11 "Built for serious traders" audience section (Developing Trader 2yrs /
Consistent Trader 2–5yrs / Prop Firm Trader)
VERDICT: CHANGE
- Copy principle: written for BOTH beginners and experienced, to help not
  impress. "Serious traders" + no true beginner card excludes half the
  audience. Add a genuine beginner card ("New Trader — build the right habits
  before the bad ones form").
- The "2 years experience" tier is not a developing trader; fix the labels.
- Prop Firm card says "on-chain proof" → "a verifiable behavioral record"
  (honesty rule: what's verified is the record, not the trading).

1.12 Final CTA: "Your discipline is your edge." / "No signals. No shortcuts.
Just honest feedback that makes you a better trader."
VERDICT: KEEP
On-message, honest, correct tone.


================================================================================
PAGE 2 — about.ejs
================================================================================

2.1 Header: "Built by a trader, for traders. KAIZEN exists because the gap
between knowing your rules and following them is where most accounts go to die."
VERDICT: KEEP
Exactly the frozen ABOUT story. Human, true, well said.

2.2 The Problem: "80-90% of retail traders lose money. Not because of bad
strategies... Because of behavioral failures... The strategy works. The
execution does not."
VERDICT: KEEP (owner decision: keep the number or soften to "Most retail
traders lose money")
The behavioral framing is the frozen problem statement verbatim in spirit.
The 80–90% figure is widely cited but hard to source precisely; the softer
version is bulletproof. Owner's call.

2.3 The Solution: "An AI that learns how you trade, specifically."
VERDICT: CHANGE
Frames the AI as the product. The product is the improvement loop; the AI is
the analysis engine inside it. Rewrite around the core loop, then keep the
existing strong detail ("analyzes your entries against your own stated rules
and full session history"). Rename "The Discipline Score measures your
process consistency" → KAIZEN Score, and mention it has five dimensions
(Process, Risk, Execution, Behavior, Learning & Consistency) without dumping
detail — bait, not confusion.

2.4 Pillar 1: "Behavioral AI, Not Signals"
VERDICT: KEEP
Perfect. This is the differentiator.

2.5 Pillar 2: "Psychology, Not Just Trade Analysis"
VERDICT: KEEP
Perfect. Psychology coach is on the KEEP list.

2.6 Pillar 3: "Dual On-Chain Reputation"
("KAIZEN is the first trading discipline platform with dual blockchain
reputation... ZA DAO on Stacks records your discipline milestones and trading
credentials. Mantle records KAIZEN AI's own performance...")
VERDICT: CHANGE (full rewrite)
Three problems:
- It positions blockchain as a top-3 differentiator (de-emphasize rule).
- It assigns the WRONG roles: frozen says Stacks = wallet identity,
  Mantle = credential records, ZA = optional external Web3 reputation.
  The current text has ZA recording credentials on Stacks.
- "Dual blockchain reputation" as a phrase is Web3-first language.
Replace with a "Progress You Can Prove" pillar: your improvement becomes a
record → credentials → optionally verifiable. Blockchain is the plumbing,
one sentence maximum.

2.7 Pillar 4: "Built From Real Experience"
VERDICT: KEEP
Honest founder story. Helps, doesn't impress. Keep.

2.8 "On-Chain Integrations" section (ZA DAO card + Mantle
"AI Performance Benchmarking" card, Sepolia testnet link)
VERDICT: CHANGE (rebuild as "Identity & Verification")
Rebuild as the frozen wallet story:
- Connect your wallets (Stacks, Ethereum, and more) — optional, private
  by default.
- Credentials are recorded on Mantle so they can be independently verified.
- Zero Authority is an optional Web3 reputation link, not part of KAIZEN.
Also: the Mantle link currently points at the Sepolia TESTNET explorer —
either label it testnet honestly or remove the link until mainnet.

2.9 Mission quote: "KAIZEN scores discipline, not P&L — because consistent
process is what creates consistent profit."
VERDICT: CHANGE
The second half violates the honesty rule. "Consistent process creates
consistent profit" is a profitability claim — the exact thing the frozen
definition forbids ("KAIZEN should not claim that a high score means a
trader will be profitable"). Suggested rewrite:
> "KAIZEN scores process, not P&L — because improvement is the one thing
> you can actually control."

2.10 CTA: "Start Building Your Discipline Record"
VERDICT: KEEP (rename to "Start Building Your Improvement Record")


================================================================================
PAGE 3 — services.ejs
================================================================================

3.1 Header: "What KAIZEN Gives You / Every feature built around one
principle — provable trading discipline."
VERDICT: CHANGE
The principle is now "measurable improvement" — verification is the output,
not the principle. Also decide the page's own name: "Services" vs "Platform"
(owner decision; blueprint leans Platform, navbar/footer links must follow).

3.2 AI Journal Analysis
VERDICT: KEEP
Accurate and on-message.

3.3 "Discipline Score" feature card
VERDICT: CHANGE
Rename to KAIZEN Score. Rewrite description around the five dimensions:
"A single number with five dimensions — Process, Risk, Execution, Behavior,
Learning & Consistency. Measures how you trade, not what you made."
The current description ("rule compliance + psychology engagement") is
inaccurate anyway (see fact-check) and describes V1's crude ratio.

3.4 Psychology Sessions card ("Psychology engagement contributes 30% to
your overall Discipline Score")
VERDICT: CHANGE
The 30% claim is FALSE in code — must be removed now regardless of anything
else. Keep the feature description, drop the weighting claim. Exposing
internal weights also invites gaming (anti-gaming principle).

3.5 Predictive Behavioral Warnings
VERDICT: KEEP
Directly matches Behavioral Intelligence phase.

3.6 Memories Archive
VERDICT: KEEP
Real feature (Memory model), good description.

3.7 MISSING FEATURES — VERDICT: ADD
The V2 feature list from the frozen definition is not represented:
- KAIZEN TRADING SYSTEM — define your strategy, entry/exit rules, risk
  rules, no-trade conditions. The single most important V2 addition.
- PRE-TRADE PLANNING — plan before you trade; the checklist becomes the
  measure of Process.
- BEHAVIORAL INSIGHTS — the pattern detection shown on the welcome page is
  absent from the feature list.
- PROGRESS TRACKING — "compare yourself to your past self" (My Progress).
- CREDENTIALS & TRADER PROFILE — currently buried under on-chain; deserves
  its own honest feature card (marked "in development" if not yet live).
- WALLETS & VERIFICATION — one card, optional, private by default.

3.8 Platform grid: Live Charting
VERDICT: KEEP

3.9 Platform grid: "Community Leaderboard — weekly and all-time discipline
score rankings"
VERDICT: CHANGE
Directly contradicts the frozen leaderboard decision. Replace with
"My Progress — compare this month's you against last month's you," with
optional behavioral challenges as the future social layer.

3.10 Platform grid: "Achievement Badges — 20 badges..."
VERDICT: CHANGE
Badges are being rebuilt into credentials/milestones. Keep the fun layer but
reframe: streaks and milestones that mark real behavioral progress
("reward better decisions, not more trading").

3.11 Platform grid: "Trading Style Evolution"
VERDICT: CHANGE
This is the seed of the KAIZEN Trading System. Rewrite to present the
Trading System as a first-class object (see 3.7).

3.12 Platform grid: "Market News"
VERDICT: KEEP in the app, DEMOTE in marketing
Not part of the improvement story. Fine as an in-app convenience; drop it
from the public feature list or it dilutes the message.

3.13 Platform grid: Weekly AI Summary
VERDICT: KEEP

3.14 "On-Chain Reputation — Dual Blockchain" section
VERDICT: CHANGE (rebuild)
Same as About 2.8: wrong roles (ZA listed as "Trader Credentials" issuer),
"dual blockchain" headline, testnet links. Rebuild as one honest
"Verification" section per the frozen roles.

3.15 "Coming in Phase 3": Voice / Mobile App / Pro Subscription /
"NFT Discipline Avatars"
VERDICT: CHANGE
Drop "NFT Discipline Avatars" — NFT-as-product is on the de-emphasize list,
and the Trader Card (the legitimate future NFT) explicitly comes LATER and
"represents the reputation; it doesn't create it." Roadmap should reflect
the frozen FUTURE list: Trader Profile, Credentials, Trader Card, more
wallets, challenges/seasons. Voice/Mobile/Pro may stay if wanted.

3.16 CTA: "All of this, free to start."
VERDICT: KEEP


================================================================================
PAGE 4 — terms.ejs
================================================================================
Overall: already honest and substantially correct. Light-touch changes.

4.1 §1 Acceptance of Terms (operated by Dennis, the Founder)
VERDICT: KEEP

4.2 §2 What KAIZEN Is
VERDICT: CHANGE (light)
- "Discipline Score" → "KAIZEN Score."
- "View on-chain reputation data linked to ZA DAO and Mantle" → reword to
  frozen roles; ZA is optional.
- "community leaderboard" → remove/replace with progress tracking +
  optional challenges.

4.3 §3 KAIZEN Is Not Financial Advice
VERDICT: KEEP — the best section on the page
Already states past performance/score improvement doesn't guarantee results.
Add one explicit sentence to fully match the frozen honesty rule:
"A high KAIZEN Score represents consistent process and behavior. It is not
a promise or prediction of profitability."

4.4 §4 Eligibility
VERDICT: KEEP

4.5 §5 Account Registration (email/password + Google OAuth)
VERDICT: KEEP
Google OAuth verified real in code.

4.6 §6 Acceptable Use ("misrepresent your trading history... to manipulate
the Discipline Score or leaderboard")
VERDICT: CHANGE (light)
Rename score; swap leaderboard reference. ADD an honest-reporting clause
aligned with the anti-gaming architecture: KAIZEN evaluates multiple
signals over time and may adjust scores where manipulation is detected;
honest journaling is a condition of use.

4.7 §7 Journal Entries, Psychology Sessions, AI Content (Anthropic license)
VERDICT: KEEP
Good, accurate, keeps user ownership.

4.8 §8 Discipline Score and On-Chain Reputation
VERDICT: CHANGE (moderate)
- Rename score; reword Mantle paragraph to frozen role (credential records,
  hashed/anonymized — the current honesty there is good, keep it).
- ZA paragraph: reframe as optional external Web3 reputation link.
- ADD: wallet verification. Stacks wallet connect is LIVE in code but
  completely unaddressed in Terms — what connecting means, that addresses
  are stored encrypted, that it's optional and revocable.

4.9 §9–§15 (Subscriptions, IP, Third-Party Services, Warranties, Liability,
Termination, Changes)
VERDICT: KEEP
Third-party list is accurate (verified). Consider adding Render (hosting)
and wallet providers to the list.

4.10 §16 Governing Law (Federal Republic of Nigeria)
VERDICT: KEEP
Matches the owner's answer: Nigerian business, global audience.

4.11 §17 Contact
VERDICT: KEEP


================================================================================
PAGE 5 — privacy.ejs
================================================================================
Overall: strong bones, one real bug, one big omission (wallets).

5.1 §1 Introduction
VERDICT: KEEP
Honest about sensitive data (trading behavior, psychological state).

5.2 §2 Information We Collect
VERDICT: CHANGE + ADD
All existing categories are accurate. ADD the missing category — WALLET DATA:
connected wallet addresses (stored AES-256-GCM encrypted, looked up via
keyed HMAC fingerprints, never displayed publicly by default), wallet
verification nonces (stored only as SHA-256 hashes), and versioned consent
records. This is live code with zero privacy coverage today.

5.3 §3 How We Use Your Information
VERDICT: CHANGE (light)
Renames; replace "display your position on the community leaderboard" with
the challenges/progress framing.

5.4 §4 Third-Party Processing
VERDICT: KEEP + ADD
The Anthropic/MongoDB/Google/Resend/ZA/Mantle descriptions are good and
match code. ADD wallet providers (signature happens client-side; seed
phrases never touch KAIZEN servers) and Render (hosting). Reword Mantle
entry to credential records per frozen roles.

5.5 §5 Data Storage and Security
VERDICT: KEEP + ADD
ADD the wallet-security specifics — encrypted addresses, HMAC fingerprints,
hashed nonces. It's real, it's verifiable, and it's the strongest security
statement the platform can honestly make.

5.6 §6 Data Retention (incl. blockchain immutability honesty)
VERDICT: KEEP
This is exactly the honest framing the frozen rules require.

5.7 §7 Your Rights
VERDICT: KEEP + ADD one line
Since the business is Nigerian: reference the Nigeria Data Protection Act
2023 alongside existing rights (with the caveat that final legal language
gets a lawyer's review before scale).

5.8 §8 Children's Privacy
VERDICT: KEEP

5.9 §9 "Cookies and Session Data"
VERDICT: FIX (bug)
Currently contains a duplicate of §10's text (international transfers).
There is no actual cookie/session content. Write the real thing:
session cookie for login (express-session), theme preference, no
third-party advertising trackers.

5.10 §10 International Data Transfers
VERDICT: KEEP (once §9 is fixed and the duplicate removed)

5.11 §11–§12 Changes / Contact
VERDICT: KEEP

5.12 Both legal pages: "Last updated: June 2026"
VERDICT: CHANGE → September 2026 when the rewrite ships.


================================================================================
SHARED: navbar.ejs / footer.ejs (affects all five pages)
================================================================================

- Footer (Privacy, Terms, Help, Support): KEEP. Consider adding About.
- Navbar (logged-out menu): About / Services / Help Center / Support.
  Fine for now; full navigation rebuild is a separate work item (the
  blueprint's REBUILD list includes navigation) once IA is settled.
- Wherever "Discipline Score" appears in shared UI → "KAIZEN Score."


================================================================================
SUMMARY
================================================================================

welcome.ejs   6 KEEP · 5 CHANGE · 1 REMOVE-item · 0 ADD   — strongest page; mostly renames + de-Web3 the hero + fix step 4 + beginner card
about.ejs     4 KEEP · 4 CHANGE                          — keep the story, fix blockchain roles, fix the profit claim, fix testnet links
services.ejs  5 KEEP · 6 CHANGE · 6 ADD                  — biggest rebuild: false 30% claim, leaderboard, badges→credentials, missing V2 features
terms.ejs     13 KEEP · 3 CHANGE · 2 ADD                 — healthiest page; renames + wallet terms + honesty sentence
privacy.ejs   9 KEEP · 3 CHANGE · 4 ADD · 1 FIX          — add wallet data, fix §9 bug, add security specifics

Facts that must change regardless of decisions:
1. Remove the false "30% psychology" claim (services.ejs 3.4)
2. Fix privacy §9 duplicate text (5.9)
3. Fix or label Mantle Sepolia testnet links (2.8, 3.14)
4. Add wallet verification to Terms + Privacy (4.8, 5.2)
5. "Discipline Score" → "KAIZEN Score" everywhere


================================================================================
DECISIONS NEEDED FROM OWNER (before Step 3 copy rewrite)
================================================================================

D1. HERO: Keep "Most traders know their rules. Few follow them." as the
    headline (recommended) with the identity line "Become the trader you can
    prove you're becoming" moved into the sub-copy — or swap them?

D2. PAGE NAME: Rename "Services" to "Platform"? (Affects navbar, footer,
    routes, page title.)

D3. LEADERBOARD: Confirm full replacement with "My Progress" now and
    optional behavioral challenges later (the live leaderboard page stays
    untouched in the app for now — this is only about public messaging).

D4. MANTEL TESTNET: Label the current records as testnet honestly, or
    remove public credential/explorer claims until mainnet?

D5. ROADMAP SLOT: Which coming-soon items do we show? (Trader Profile /
    Credentials / Trader Card / Challenges / more wallets — versus Voice /
    Mobile / Pro subscription.)

D6. THE 80–90% STAT: Keep the number or soften to "Most retail traders
    lose money"?


================================================================================
CORRECTION — LIGHT THEME COVERAGE (owner, 14 Sep 2026)
================================================================================

The original audit missed a coverage dimension: KAIZEN ships with a theme
toggle (dark default, light parity), yet every direction mockup in this
reset was presented in dark mode only, and this audit never flagged it.

Resolved:
- Light-mode versions of all mockups now exist alongside the dark ones:
  01-welcome-hero-light.jpg, 02-score-dial-light.jpg,
  03-improvement-loop-light.jpg, 04-verification-light.jpg,
  d8a-lightweight-plan-light.jpg, d8c-freeform-journal-light.jpg,
  d9a-v2-nav-light.jpg (contact sheet: all-light-theme.jpg).
- Rule going forward (frozen in config/Design.js): every mockup is
  produced in BOTH themes. A design approved in one theme is not approved
  until it is seen in the other.
- Verified in code: the V2 component CSS is token-driven and light-parity
  — [data-theme="light"] flips every token; the only component-specific
  light overrides needed (grid texture, elevated shadow, hover shadow)
  exist. The live preview can be toggled to light to verify the shipped
  pages in both themes.


================================================================================
NEXT STEP
================================================================================

Step 3 — Rewrite the copy. Once D1–D6 are answered, the copy for all five
pages gets rewritten section by section per the verdicts above, with the
frozen terminology locked: KAIZEN Score (five dimensions), core loop,
Identity & Verification, credentials as the output of improvement.

Only after the copy is approved does anything move to visual design, and
only then to code.
