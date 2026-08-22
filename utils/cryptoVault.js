/**
 * KAIZEN crypto vault — wallet address protection layer.
 *
 * Wallet addresses are stored ENCRYPTED (AES-256-GCM), never in plaintext.
 * Lookups use a keyed HMAC fingerprint instead of the raw address, so even a
 * database dump does not expose which wallets belong to which users unless the
 * server-side keys are also compromised.
 *
 * Required environment variables (production):
 *   KAIZEN_WALLET_ENCRYPTION_KEY  32 bytes as hex (64 chars) — generate with: openssl rand -hex 32
 *   KAIZEN_WALLET_HMAC_SECRET     long random string        — generate with: openssl rand -hex 24
 *
 * In development (NODE_ENV !== 'production') a deterministic fallback key is
 * used with a loud warning, so local testing works without configuration.
 */

const crypto = require('crypto');

let warned = false;

function warnOnce(msg) {
  if (!warned) {
    console.warn(`\n⚠️  [cryptoVault] ${msg}\n`);
    warned = true;
  }
}

function getEncryptionKey() {
  const raw = process.env.KAIZEN_WALLET_ENCRYPTION_KEY;

  if (raw) {
    // Accept 64-char hex (32 bytes) or 44-char base64 (32 bytes)
    const fromHex = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : null;
    const fromB64 = !fromHex && /^[A-Za-z0-9+/]{43}=$/.test(raw)
      ? Buffer.from(raw, 'base64')
      : null;
    const key = fromHex || fromB64;
    if (key && key.length === 32) return key;
    throw new Error(
      'KAIZEN_WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars). ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'KAIZEN_WALLET_ENCRYPTION_KEY is not configured. Wallet features are disabled. ' +
        'Set it with: openssl rand -hex 32'
    );
  }

  warnOnce(
    'KAIZEN_WALLET_ENCRYPTION_KEY not set — using an INSECURE development key. ' +
      'Never run production without it.'
  );
  return crypto.createHash('sha256').update('kaizen-dev-only-key').digest();
}

function getHmacSecret() {
  const raw = process.env.KAIZEN_WALLET_HMAC_SECRET;
  if (raw && raw.length >= 16) return Buffer.from(raw);

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'KAIZEN_WALLET_HMAC_SECRET is not configured (min 16 chars). Wallet features are disabled.'
    );
  }

  warnOnce('KAIZEN_WALLET_HMAC_SECRET not set — using an insecure development secret.');
  return Buffer.from('kaizen-dev-hmac-secret');
}

/**
 * Encrypt a string with AES-256-GCM.
 * Output format: enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 */
function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    'enc:v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
}

/**
 * Decrypt a payload produced by encrypt(). Throws on tampering or bad key.
 */
function decrypt(payload) {
  if (typeof payload !== 'string' || !payload.startsWith('enc:v1:')) {
    throw new Error('Invalid encrypted payload');
  }
  const [, , ivB64, tagB64, dataB64] = payload.split(':');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

/**
 * Keyed HMAC-SHA256 fingerprint of a wallet address.
 * Used for duplicate/ownership lookups without storing the raw address.
 */
function hmacAddress(address) {
  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(String(address).trim())
    .digest('hex');
}

/** SHA-256 hex digest (used for nonce storage — we never store raw nonces). */
function sha256hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { encrypt, decrypt, hmacAddress, sha256hex };
