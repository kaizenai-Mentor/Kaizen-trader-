# The Mantle Walkthrough — fixing the zeros and making the explorer readable

This guide answers two questions:
1. How do I confirm the wallet/private-key situation and fix it? (Numbers 1 & 2.)
2. When a user opens the Mantle explorer, how do they confirm what KAIZEN did —
   it's just transaction hashes?

Everything here uses two facts about the deployed `KaizenBenchmark.sol`:
- **The deployer is the owner.** The constructor sets `owner = msg.sender`, and
  every `record…` function is `onlyOwner`. Whoever deployed from Termux IS the
  only wallet that can write records.
- **The deployed contract has NO `transferOwnership` function.** Ownership
  cannot be moved after deployment. The server's key must BE the deployer key
  (or you deploy a fresh contract).

---

## PART A — Confirm what you have (3 checks, ~5 minutes)

### Check 1: Who is the owner of the contract?

**Easiest — the explorer (no tools needed):**
1. Open `https://explorer.sepolia.mantle.xyz/address/<your contract address>`
2. On the overview you will find **"Creator"** (the wallet that deployed it).
3. That creator address IS the owner (the constructor makes them the same).

**Or with the diagnostic script** (from the `contracts/` folder in Termux):
```bash
MANTLE_CONTRACT_ADDRESS=0xYourContract node check-owner.js
```
It prints `Owner (the deployer wallet): 0x…` — same address as the explorer's
Creator line.

> Where did this address come from? When you ran `deploy-quick.js` from Termux,
> it printed `Deploying from: 0x…` and `Owner: 0x…`. That key came from the
> `MANTLE_PRIVATE_KEY` you set in that Termux session.

### Check 2: What address does the key on Render control?

1. In Termux (same folder), run the diagnostic with the key your server uses:
   ```bash
   MANTLE_CONTRACT_ADDRESS=0xYourContract MANTLE_PRIVATE_KEY=0xTheKeyOnRender node check-owner.js
   ```
   To get the key: Render dashboard → your service → **Environment** → reveal
   `MANTLE_PRIVATE_KEY`.
2. The script prints `Server key controls: 0x…` and then either:
   - **✓ MATCH** — the server key IS the owner. Writes will succeed. Done.
   - **✗ MISMATCH** — every record write is reverting with "Not authorized".
     This is the zero-records bug. Fix it in Part B.

**Security rule:** the private key goes ONLY into environment variables in
tools you control (Termux, Render). Never paste it into a website, a chat, or
the explorer.

### Check 3: Is MANTLE_CONTRACT_ADDRESS on Render the right contract?

1. Render dashboard → Environment → `MANTLE_CONTRACT_ADDRESS` — copy it.
2. Open it on the explorer. Confirm:
   - the page shows a real contract (not "no contract found"),
   - the **Creator** matches the owner from Check 1.
3. If you deployed more than once from Termux, you may have several
   `KaizenBenchmark` contracts — make sure Render points at the one you intend,
   and that the key from Check 2 matches THAT contract's creator.

The diagnostic does all three checks in one command when you give it both env
vars — including the records count at the end.

---

## PART B — Fixing a mismatch (choose one)

### Option 1 (simplest): put the deployer key on Render

If you still have the Termux key that deployed the contract:
1. Render → Environment → `MANTLE_PRIVATE_KEY` → replace with the Termux
   deployer key.
2. Save (Render restarts the service).
3. Run Check 2 again (or watch the logs) — you should see `✓ MATCH`.

From that moment, journal-triggered records actually land on-chain and the
reputation page shows real records (it reads them live).

### Option 2 (clean slate): deploy a fresh contract

Worth considering because the current contract holds **zero successful
records anyway** (that's the bug — every write reverted, so nothing is lost
by redeploying):

1. Create ONE new dedicated key (this key will be both deployer and server
   writer — owner matches by construction):
   ```bash
   node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Deploy from Termux with it:
   ```bash
   MANTLE_PRIVATE_KEY=0xNewKey node deploy-quick.js
   ```
   (Fund the address with testnet MNT from `faucet.sepolia.mantle.xyz` first —
   the script checks the balance for you.)
3. On Render, set BOTH:
   - `MANTLE_CONTRACT_ADDRESS` → the new address the script prints
   - `MANTLE_PRIVATE_KEY` → `0xNewKey`
4. Run the diagnostic — expect `✓ MATCH`.

**Optional but recommended for the new contract:** while you're at it, verify
the source on the explorer (Part C) so transactions become human-readable.

---

## PART C — Making the explorer human-readable (source verification)

**Why it's "just transaction hashes" today:** the contract's source code was
never verified on the explorer. An unverified contract shows raw hex input and
raw logs — meaningless to humans.

**After verification, every transaction page shows decoded, plain-English
data:** `recordScoreChange(userId, 61, 74, "Two clean sessions this week.")`
and the emitted event with its fields. Anyone can read what KAIZEN recorded
without trusting anyone.

**How to verify (one time, ~10 minutes):**

1. Open the explorer at your contract address → **"Verify & Publish"** (in the
   Code tab's verification section).
2. Choose:
   - Compiler: **`v0.8.36+commit.845d305f`** (from `contracts/package-lock.json`)
   - Optimization: **No** (deploy.js compiles with the optimizer disabled)
   - EVM version: **london**
   - License: **MIT**
3. Paste the ENTIRE contents of `contracts/KaizenBenchmark.sol` as a single
   file.
4. Submit. If the compiler version doesn't match, retry with the nearest
   `0.8.2x` version — verification is harmless to retry.

If verification keeps failing, Option 2's fresh redeploy can be done through a
toolchain that produces verification files automatically — but try the manual
route first; with the settings above it should match.

---

## PART D — How YOUR USERS confirm what KAIZEN did

Three layers, from easiest to most independent:

**Layer 1 — the reputation page (primary UX, already built):**
"Recent On-Chain Records" lists each record decoded into English —
`SCORE · Score 61 → 74 · Two clean sessions this week.` — with its date and a
direct link to the transaction. Users read the record in KAIZEN and click
through to the immutable proof. They never need to parse anything.

**Layer 2 — the transaction page (after Part C verification):**
Opening a record's tx link shows the decoded call and event in plain English —
the same words KAIZEN's page showed. This is the independent check: the string
lives inside an immutable event, so it cannot have been edited after the fact.

**Layer 3 — even without verification (today):**
Open a transaction → the **Logs** section → expand the raw data. The `reason`
text is embedded in the data as plain text — you can literally read your
record's words inside the hex blob. Clunky, but it proves the data is there.

**The trust story in one sentence:** KAIZEN computes and displays; the chain
holds the same words immutably; anyone can click a link and see them —
that's "KAIZEN records, Mantle proves."

---

## Quick reference

| Task | Command / place |
|---|---|
| Full diagnostic (owner / key match / records) | `MANTLE_CONTRACT_ADDRESS=0x… MANTLE_PRIVATE_KEY=0x… node contracts/check-owner.js` |
| Owner only, no key | `MANTLE_CONTRACT_ADDRESS=0x… node contracts/check-owner.js` |
| Owner via explorer | contract page → "Creator" |
| Server key on Render | dashboard → Environment → `MANTLE_PRIVATE_KEY` |
| Deploy fresh | `MANTLE_PRIVATE_KEY=0x… node contracts/deploy-quick.js` |
| Testnet MNT faucet | `https://faucet.sepolia.mantle.xyz` |
| Verify source | explorer → contract → Verify & Publish (solc 0.8.36, no optimizer, london, MIT) |
| In-product records | reputation page → "Recent On-Chain Records" |
