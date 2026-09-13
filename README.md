# KAIZEN — Trader Improvement & Reputation Platform

> KAIZEN is a trader improvement and reputation platform that turns
> trading behavior into measurable progress and verifiable credentials.

**Core loop:** PLAN → TRADE → REFLECT → ANALYZE → IMPROVE → REPEAT

The blockchain components support the reputation layer. They aren't
the reason KAIZEN exists — the user never needs to care about
blockchain to use the product.

## The V2 Product (this branch)

### Sessions — the core loop, run one trade at a time
- **PLAN** (before): declare setup, entry condition, invalidation,
  risk, emotional state + confidence — under a minute, measured
  against the versioned Trading System that was active at the time
- **RECORD** (after): freeform journal first — what changed during and
  after the trade — plus quick checks that only capture what the notes
  don't mention (followed plan? within entry criteria? respected risk?
  outcome). Asset/timeframe auto-detected from the writing.
- **REFLECT**: four prompts in the trader's own words
- **ANALYZE**: two machines, one response — the deterministic Score
  Engine computes; KAIZEN AI (改) explains and coaches. The AI never
  generates a number.
- **Session types**: LIVE, BACKTEST (practice execution), and STUDY
  (market analysis, no trade) — unlocking the practice-vs-performance
  gap as a coachable pattern

### The KAIZEN Score — five dimensions
Process · Risk · Execution · Behavior · Learning & Consistency

- Deterministic and formula-versioned (`services/scoreEngine.js`);
  reproducible from the same evidence, every time
- Honest states: `BUILDING` (no fake numbers), `PARTIAL`
  (partially estimated from extracted V1 history — disclosed),
  `READY`
- Anti-gaming by architecture: multi-signal evidence over rolling
  windows, contradiction-aware, integrity guards (cadence, duplicate
  text, low-signal diversity). A perfect streak is the *Maintaining*
  state — high compliance is never a flag
- One-time V1 evidence extraction: explicitly stated facts are read
  from legacy journals once, tagged, and weighted below declared data

### Trading System — the first-class rules object
Versioned on every save (`models/TradingSystem.js`); each session is
measured against the version the trader had at the time. Existing
users migrate lazily from the legacy trading style — nothing is lost.

### Identity & Verification (optional)
- Stacks wallet connection with cryptographic ownership proof
  (server-side recovery; addresses AES-256-GCM encrypted, HMAC
  fingerprint lookups, hashed nonces, versioned consent records)
- Mantle (testnet) records for earned credentials — KAIZEN calculates
  off-chain; the chain only records. Journal text never touches a chain
- Zero Authority as optional external Web3 reputation

### Site-wide announcement ticker
Slim news-style bar above the navbar — megaphone at the entry side,
scrolling announcements with their own time windows (20–25 days).
Renders only when an announcement is active. Seed:
`node scripts/seed-announcement.js ["message"] [days]`

## Product Specs (frozen)
The V2 rebuild is specified in-repo, in order:
- `config/New.js` — the V1 blueprint (positioning reset)
- `config/Start.js` — frozen product philosophy + decisions 1–20
- `config/Audit.js` / `config/Copy.js` / `config/Design.js` — public
  pages: audit, approved copy, design system ("The Disciplined Dojo")
- `config/App.js` / `config/AppAudit.js` / `config/AppCopy.js` /
  `config/AppDesign.js` / `config/CoreLoop.js` — the in-app core loop:
  frozen definition, audit, copy, design, walkthrough
- `design/mockups/` — direction mockups (every design in both themes)

## Tech Stack
Node.js · Express · MongoDB Atlas · EJS · Anthropic Claude (analysis
coach) · Solidity · @stacks/connect

## Tests
```
npm test
```
Engine + extraction suites (`test/scoreEngine.test.js`,
`test/extraction.test.js`) pin the frozen scoring contract: perfect
streaks score fully, honest skips get partial credit, untouched checks
never count, extracted evidence is dampened, farming attempts become
Behavior evidence.

## Smart Contracts
KaizenBenchmark.sol deployed on Mantle Sepolia testnet (labeled
honestly as testnet in all user-facing copy)

## Run Locally
```
npm install
npm run build:wallet-bundle   # only needed if src/wallet-bundle.js changes
npm start                     # requires MONGODB_URI (see .env.example)
node scripts/dev-preview.js   # local page preview without a database
```

Required env vars for wallet features (see `.env.example`):
- `KAIZEN_WALLET_ENCRYPTION_KEY` — 32 bytes hex (`openssl rand -hex 32`)
- `KAIZEN_WALLET_HMAC_SECRET` — long random string (`openssl rand -hex 24`)
- `STACKS_NETWORK` — `mainnet` (default) or `testnet`

## Live
https://kaizen-trader.onrender.com
