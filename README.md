# KAIZEN — Trading Discipline & Behavioral Reputation

KAIZEN is a trading discipline platform that analyzes journal
entries with Claude AI, scores discipline sessions (process,
not P&L), and delivers personalized coaching.

KAIZEN is evolving into a **behavioral reputation layer for
Bitcoin DeFi on Stacks**: wallet-verified on-chain activity is
translated into evidence-backed discipline credentials.

## Features
- AI journal analysis powered by Anthropic Claude
- Discipline Score tracking (process, not P&L)
- Psychology sessions for mindset work
- Stacks wallet connection with cryptographic ownership proof
- Dual on-chain reputation: Zero Authority DAO + Mantle
- TradingView-integrated charting
- Achievement badges and community leaderboard

## Stacks Phase 1 — Wallet Verification (live in this repo)
- Server-issued one-time nonce, signed through the Stacks
  `stx_signMessage` method (Leather, Xverse, any compatible wallet)
- Uses the current Stacks Connect request API; Xverse receives its required
  public key and mobile users are handed off to the Xverse in-app browser
- Installable web-app metadata is served from `/manifest.json`
- Server-side signature recovery proves address ownership —
  a client can never link an address it does not control
- Wallet addresses stored AES-256-GCM encrypted; lookups use keyed
  HMAC fingerprints; nonces stored only as SHA-256 hashes
- Versioned consent records with a full audit trail
- Endpoints: `POST /api/wallet/nonce`, `POST /api/wallet/verify`,
  `GET /api/wallet/status`, `POST /api/wallet/disconnect`

Coming next (Phase 1B+): Hiro API activity ingestion, deterministic
discipline metrics, verified-vs-self-reported labeling, and Stacks
credential issuance.

## Tech Stack
Node.js · Express · MongoDB Atlas · EJS · Solidity · @stacks/connect

## Smart Contracts
KaizenBenchmark.sol deployed on Mantle Sepolia testnet

## Run Locally
```
npm install
npm run build:wallet-bundle   # only needed if src/wallet-bundle.js changes
node server.js
```

Required env vars for wallet features (see `.env.example`):
- `KAIZEN_WALLET_ENCRYPTION_KEY` — 32 bytes hex (`openssl rand -hex 32`)
- `KAIZEN_WALLET_HMAC_SECRET` — long random string (`openssl rand -hex 24`)
- `STACKS_NETWORK` — `mainnet` (default) or `testnet`

## Live
https://kaizen-trader.onrender.com
