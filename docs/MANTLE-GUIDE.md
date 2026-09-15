# The Mantle Walkthrough — fixing the zeros and making the explorer readable

This guide answers two questions:
1. How do I confirm the wallet/private-key situation and fix it? (Numbers 1 & 2.)
2. When a user opens the Mantle explorer, how do they confirm what KAIZEN did —
   it's just transaction hashes?

Everything here uses three facts about the deployed `KaizenBenchmark.sol`:
- **The deployer is the owner.** The constructor sets `owner = msg.sender`, and
  every `record…` function is `onlyOwner`. Whoever deployed from Termux IS the
  only wallet that can write records.
- **The deployed contract has NO `transferOwnership` function.** Ownership
  cannot be moved after deployment. The server's key must BE the deployer key
  (or you deploy a fresh contract).
- **The deployed code must be the CURRENT build.** The contracts deployed
  before 15 Sep 2026 were an old build without the app's functions — every
  write reverted regardless of keys. `check-owner.js` now fingerprints the
  bytecode for this.

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

## PART B — Fixing the zeros (a fresh deploy of the CURRENT source is required)

**What the bytecode proved (15 Sep 2026):** every contract ever deployed
from Termux runs an OLD build of the code — one that does not contain the
functions the app calls (`recordScoreChange` etc.). Every write reverted
because the function didn't exist on the contract, **not** because of the
key. No key change alone can fix that: the current `KaizenBenchmark.sol`
must be deployed fresh. Nothing is lost — the old contracts hold zero
successful records.

1. On Termux, get the CURRENT repo (this matters — old local copies and the
   old `deploy-quick.js` are what shipped the outdated code):
   ```bash
   git pull
   cd contracts && npm install
   ```
2. Pick the key: your usual Termux wallet key (the app has used it before —
   its writes came from `0x5Cc4664b…`), or ONE new dedicated key:
   ```bash
   node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
   ```
   Fund it with testnet MNT from `faucet.sepolia.mantle.xyz` if needed.
3. Deploy (both scripts now compile the current source — `deploy-quick.js`
   was rewritten on 15 Sep 2026 for exactly this reason):
   ```bash
   MANTLE_PRIVATE_KEY=0xYourKey node deploy-quick.js
   ```
4. On Render, set BOTH:
   - `MANTLE_CONTRACT_ADDRESS` → the new address the script prints
   - `MANTLE_PRIVATE_KEY` → the SAME key you deployed with
5. Run the diagnostic — expect BOTH lines:
   - `Contract code: CURRENT KaizenBenchmark build ✓`
   - `✓ MATCH — the server key IS the owner. Writes will succeed.`
6. Log one test journal session, then open the transaction on the explorer:
   its **Status must be green (Success)** — that is the moment the zeros
   are gone.

**Optional but recommended:** verify the source on the explorer (Part C) so
transactions become human-readable.

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

If verification keeps failing, the fresh redeploy (Part B) can be done through a
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

## PART E — Reading the explorer like a pro (lessons from the owner's addresses)

### Contract vs wallet, at a glance
- A **contract page** shows a *Contract Creator* line (who deployed it) and
  Read/Write Contract sections. A **wallet page** shows neither.
- In any transaction list, when the **To** column reads "Contract Creation"
  and links an address — that transaction DEPLOYED the linked contract.
- A contract's first activity is always its creation transaction.

### A transaction appearing ≠ a transaction succeeding
Every transaction pays gas and gets listed — even failed ones. Open the
transaction page and read the **Status** field:
- **Success** (green) — the record actually landed on-chain.
- **Fail** (red, "execution reverted") — the record did NOT land, even though
  the tx is visible in lists and links.
On any address page, the **"View Failed Txns"** filter shows all failures at
once. Always confirm Status before believing a record exists.

### Why every deployment gives a NEW address (this is normal)
A contract's address is not chosen by you and not derived from the code —
the chain computes it from exactly two things: **the deployer's address**
and **the deployer's transaction count (the "nonce")** at the moment of
deployment. Every transaction a wallet sends — a deployment, a transfer,
anything — permanently consumes one nonce, and the chain forbids reusing
one. So the same wallet can never produce the same contract address twice:
even byte-identical code, deployed twice, lands on two different addresses.
The six contracts on the map below are one wallet at six different nonce
slots.

A new address per deploy is therefore **not** a bug and not a sign the
deploy failed. What matters after each deploy is that Render's
`MANTLE_CONTRACT_ADDRESS` points at the newest address, and that the
deployer key is the key Render uses. (Ethereum-style chains also have a
fancier "CREATE2" mechanism that can pre-compute addresses, but standard
deploy scripts don't use it — and it wouldn't help here anyway.)

### The owner's deployment map (found via the explorer, 15 Sep 2026)
- **Termux wallet (the real working one):** `0x5Cc4664bFA670BB155671B15568835Afd463Be2C`
- `0xE1145be6186D22FF92dc92192F1750E75F2813f1` — a CONTRACT created by that
  wallet on Aug 26. The explorer reports five more contracts with
  byte-for-byte identical code; with six creations in total from this
  wallet, that is almost certainly all of them — so the earlier
  "token/test" guess for this one is retired: it is the same old
  KaizenBenchmark build. (Its "Transfer\*" labels are just the explorer's
  placeholder for calls it cannot decode on an unverified contract.)
- The other deployments by the same wallet:
  `0x47469b582cbe80d9Fa0253af3e139C1ca8cDCCD1` (Aug 23),
  `0x79c840CC4B0E4d0e76D7337bE12e1D86962Eeb50` (Sep 2),
  `0xd13169A27E8C1c3225Fe33df953a03A0Ae63988B` (Sep 2),
  `0x45716a3F91ae2Db5281fe9d8c4ADd318690C366F` (Sep 3),
  `0xeFdf3F3561352e95167Dfbd911458905F1748bb4` (Sep 3 — the latest).
- **Finding (updated 15 Sep 2026 — root cause proven from the bytecode):**
  all of these contracts run the SAME old 1,970-byte build, whose code
  contains only five external functions — and NONE of them are the
  functions the current app calls. Every function has an address-like
  "fingerprint" (a selector); the app calls `recordScoreChange`
  (`0x42c4aa4c`), `recordPattern` (`0xb68f0c17`), `recordMilestone`
  (`0x8325f872`) and `getTotalEvents` (`0x61606940`) — and none of those
  fingerprints appear anywhere in the deployed bytecode. The current
  `KaizenBenchmark.sol` compiles to 12 functions / 5,847 bytes and contains
  all of them.
  The failed Sep 2/Sep 3 record transactions were sent FROM the owner's own
  wallet — so the owner check passed; the calls bounced because the
  functions simply don't exist on the old code. (This retires the earlier
  "owner check" inference: the key was never the cause of these failures.)
  Where did the old code keep coming from? The repo's original
  `deploy-quick.js` contained that exact old bytecode as a hardcoded
  string, with a NEWER ABI pasted above it — deploying it could only ever
  reproduce the old code, no matter what the `.sol` said. That script was
  rewritten on 15 Sep 2026 to compile the current source on every run.

| Task | Command / place |
|---|---|
| Full diagnostic (owner / key match / records) | `MANTLE_CONTRACT_ADDRESS=0x… MANTLE_PRIVATE_KEY=0x… node contracts/check-owner.js` |
| Owner only, no key | `MANTLE_CONTRACT_ADDRESS=0x… node contracts/check-owner.js` |
| Owner via explorer | contract page → "Creator" |
| Server key on Render | dashboard → Environment → `MANTLE_PRIVATE_KEY` |
| Deploy fresh (compiles the CURRENT source) | `MANTLE_PRIVATE_KEY=0x… node contracts/deploy.js` (or `deploy-quick.js` — identical now) |
| Verify the deployed code is current | included in check-owner.js (fingerprints the bytecode for the current build's functions) |
| Testnet MNT faucet | `https://faucet.sepolia.mantle.xyz` |
| Verify source | explorer → contract → Verify & Publish (solc 0.8.36, no optimizer, london, MIT) |
| In-product records | reputation page → "Recent On-Chain Records" |
