const crypto = require('crypto');
const WalletConnectNonce = require('../models/WalletConnectNonce');
const ConnectedWallet = require('../models/ConnectedWallet');
const ConsentRecord = require('../models/ConsentRecord');
const { encrypt, decrypt, hmacAddress, sha256hex } = require('../utils/cryptoVault');
const { verifyStacksMessageSignature } = require('../utils/stacksSignature');

const CONSENT_VERSION = '1.0';
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NETWORK = process.env.STACKS_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

// ---------------------------------------------------------------------------
// Tiny in-memory rate limiters (per user). This is a defense against nonce
// spam and brute-force signature guessing; it is deliberately dependency-free.
// ---------------------------------------------------------------------------
const rateBuckets = new Map();

function withinLimit(key, maxHits, windowMs) {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter(ts => now - ts < windowMs);
  if (bucket.length >= maxHits) {
    rateBuckets.set(key, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  return true;
}

// Periodic cleanup so the Map does not grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    const fresh = bucket.filter(ts => now - ts < 10 * 60 * 1000);
    if (fresh.length === 0) rateBuckets.delete(key);
    else rateBuckets.set(key, fresh);
  }
}, 10 * 60 * 1000).unref();

function maskAddress(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function vaultConfigError(err) {
  return (
    /KAIZEN_WALLET_ENCRYPTION_KEY|KAIZEN_WALLET_HMAC_SECRET/.test(err && err.message ? err.message : '')
  );
}

// ---------------------------------------------------------------------------
// POST /api/wallet/nonce
// Issues a single-use, short-lived ownership challenge for the current user.
// ---------------------------------------------------------------------------
exports.requestNonce = async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!withinLimit(`nonce:${userId}`, 10, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
    }

    const nonce = crypto.randomBytes(24).toString('base64url');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);

    const message =
      `KAIZEN wallet ownership verification\n\n` +
      `Account: ${req.session.user.username}\n` +
      `Nonce: ${nonce}\n` +
      `Issued: ${issuedAt.toISOString()}\n` +
      `Expires: ${expiresAt.toISOString()}`;

    await WalletConnectNonce.create({
      userId,
      nonceHash: sha256hex(nonce),
      message,
      network: NETWORK,
      expiresAt
    });

    res.json({ nonce, message, network: NETWORK, expiresAt });
  } catch (err) {
    console.error('Wallet nonce error:', err.message);
    if (vaultConfigError(err)) {
      return res.status(503).json({ error: 'Wallet service is not configured on this server yet.' });
    }
    res.status(500).json({ error: 'Could not start wallet verification. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/wallet/verify
// Consumes the nonce, verifies the SIP-018 signature, links the wallet.
// ---------------------------------------------------------------------------
exports.verifyWallet = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { nonce, publicKey, signature, consent } = req.body || {};

    if (!withinLimit(`verify:${userId}`, 20, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    if (!nonce || !signature) {
      return res.status(400).json({ error: 'Missing nonce or signature.' });
    }

    // Atomically consume the nonce: must exist, belong to this user,
    // be unused and unexpired. This makes the nonce strictly single-use.
    const nonceDoc = await WalletConnectNonce.findOneAndUpdate(
      {
        userId,
        nonceHash: sha256hex(nonce),
        usedAt: null,
        expiresAt: { $gt: new Date() }
      },
      { $set: { usedAt: new Date() } },
      { new: true }
    );

    if (!nonceDoc) {
      return res.status(400).json({ error: 'Verification challenge expired or already used. Please reconnect.' });
    }

    // Cryptographic verification — the address is derived from the recovered
    // public key, so it cannot be spoofed.
    const result = verifyStacksMessageSignature({
      message: nonceDoc.message,
      signature,
      publicKey,
      network: nonceDoc.network
    });

    if (!result.valid) {
      return res.status(400).json({ error: result.reason || 'Signature verification failed.' });
    }

    const address = result.address;
    const fingerprint = hmacAddress(address);
    const activityConsent = !!(consent && consent.activityAnalysis);

    // Is this wallet already registered (any account, this network)?
    let wallet = await ConnectedWallet.findOne({ network: nonceDoc.network, addressHmac: fingerprint });

    if (wallet && String(wallet.userId) !== String(userId)) {
      // Signature proves current control of the key — re-link to the signer.
      wallet.previousUserId = wallet.userId;
      wallet.userId = userId;
      wallet.reLinkedAt = new Date();
      wallet.status = 'active';
      wallet.disconnectedAt = null;
      wallet.verifiedAt = new Date();
      wallet.nonceHash = nonceDoc.nonceHash;
      wallet.publicKeyHex = result.publicKeyHex;
      wallet.consentVersion = CONSENT_VERSION;
      wallet.consent = { ownershipConfirmed: true, activityAnalysis: activityConsent };
      await wallet.save();
      await ConsentRecord.create({
        userId,
        walletId: wallet._id,
        type: 'wallet_relinked',
        version: CONSENT_VERSION,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null
      });
    } else if (wallet) {
      if (wallet.status === 'disconnected') {
        wallet.status = 'active';
        wallet.disconnectedAt = null;
      }
      wallet.verifiedAt = new Date();
      wallet.nonceHash = nonceDoc.nonceHash;
      wallet.publicKeyHex = result.publicKeyHex;
      wallet.consentVersion = CONSENT_VERSION;
      wallet.consent = { ownershipConfirmed: true, activityAnalysis: activityConsent };
      await wallet.save();
    } else {
      // One active wallet per user in Phase 1.
      const existingActive = await ConnectedWallet.findOne({ userId, status: 'active' });
      if (existingActive) {
        return res.status(409).json({
          error: 'Your account already has a connected wallet. Disconnect it first, then connect this one.'
        });
      }

      wallet = await ConnectedWallet.create({
        userId,
        network: nonceDoc.network,
        addressHmac: fingerprint,
        addressEncrypted: encrypt(address),
        publicKeyHex: result.publicKeyHex,
        status: 'active',
        verifiedAt: new Date(),
        nonceHash: nonceDoc.nonceHash,
        consentVersion: CONSENT_VERSION,
        consent: { ownershipConfirmed: true, activityAnalysis: activityConsent }
      });
    }

    // Consent audit trail.
    await ConsentRecord.create({
      userId,
      walletId: wallet._id,
      type: 'wallet_connected',
      version: CONSENT_VERSION,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });
    await ConsentRecord.create({
      userId,
      walletId: wallet._id,
      type: activityConsent ? 'activity_analysis_granted' : 'activity_analysis_revoked',
      granted: activityConsent,
      version: CONSENT_VERSION,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    res.json({
      connected: true,
      wallet: {
        addressMasked: maskAddress(address),
        network: wallet.network,
        verifiedAt: wallet.verifiedAt,
        consent: wallet.consent,
        consentVersion: wallet.consentVersion
      }
    });
  } catch (err) {
    console.error('Wallet verify error:', err.message);
    if (vaultConfigError(err)) {
      return res.status(503).json({ error: 'Wallet service is not configured on this server yet.' });
    }
    res.status(500).json({ error: 'Wallet verification failed. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/wallet/status
// ---------------------------------------------------------------------------
exports.getStatus = async (req, res) => {
  try {
    const wallet = await ConnectedWallet.findOne({
      userId: req.session.user.id,
      status: 'active'
    }).sort({ verifiedAt: -1 });

    if (!wallet) return res.json({ connected: false });

    let addressMasked = null;
    try {
      addressMasked = maskAddress(decrypt(wallet.addressEncrypted));
    } catch (e) {
      // Key rotation / misconfiguration — report connected but not readable.
      addressMasked = '••••';
    }

    res.json({
      connected: true,
      wallet: {
        addressMasked,
        network: wallet.network,
        verifiedAt: wallet.verifiedAt,
        consent: wallet.consent,
        consentVersion: wallet.consentVersion
      }
    });
  } catch (err) {
    console.error('Wallet status error:', err.message);
    res.status(500).json({ error: 'Could not load wallet status.' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/wallet/disconnect
// Soft disconnect: keeps the audit trail, stops any future indexing.
// ---------------------------------------------------------------------------
exports.disconnectWallet = async (req, res) => {
  try {
    const wallet = await ConnectedWallet.findOneAndUpdate(
      { userId: req.session.user.id, status: 'active' },
      { $set: { status: 'disconnected', disconnectedAt: new Date(), 'consent.activityAnalysis': false } },
      { new: true }
    );

    if (!wallet) return res.status(404).json({ error: 'No connected wallet found.' });

    await ConsentRecord.create({
      userId: req.session.user.id,
      walletId: wallet._id,
      type: 'wallet_disconnected',
      granted: false,
      version: CONSENT_VERSION,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });

    res.json({ connected: false });
  } catch (err) {
    console.error('Wallet disconnect error:', err.message);
    res.status(500).json({ error: 'Could not disconnect wallet. Please try again.' });
  }
};
