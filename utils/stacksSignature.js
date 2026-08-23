/**
 * KAIZEN Stacks signed-message verification.
 *
 * Flow:
 *   1. Server issues a one-time nonce + exact message to sign.
 *   2. The user's Stacks wallet (Leather, Xverse, etc.) signs that exact
 *      message through the @stacks/connect `stx_signMessage` request.
 *   3. Server recovers the public key from the signature, derives the Stacks
 *      address from the RECOVERED key, and links that address to the account.
 *
 * Because the address is derived from the recovered key, possession of the
 * wallet's private key is cryptographically proven — a client cannot claim an
 * address it does not control, even if it lies about `publicKey`.
 */

const { hashMessage: hashStacksMessage } = require('@stacks/encryption');
const {
  compressPublicKey,
  publicKeyFromSignatureRsv,
  getAddressFromPublicKey,
  validateStacksAddress
} = require('@stacks/transactions');

// Standard prefix used by stx_signMessage. The encoded payload also contains
// the message's Bitcoin-style variable-length integer before the UTF-8 bytes.
const STACKS_MESSAGE_PREFIX = '\x17Stacks Signed Message:\n';

/** Compute the standard Stacks signed-message hash as lowercase hex. */
function hashMessage(message) {
  return Buffer.from(hashStacksMessage(String(message))).toString('hex');
}

function normalizeHex(value) {
  let hex = String(value || '').trim();
  if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);
  return hex.toLowerCase();
}

function normalizePublicKey(value) {
  const key = normalizeHex(value);
  if (!key) return '';
  return normalizeHex(compressPublicKey(key));
}

/**
 * Verify a standard Stacks message signature and return the signer's address.
 *
 * @param {object} opts
 * @param {string} opts.message   The exact message the server asked to be signed.
 * @param {string} opts.signature 65-byte RSV signature hex (130 chars), as returned by wallets.
 * @param {string} [opts.publicKey] Public key hex reported by the wallet (advisory only).
 * @param {'mainnet'|'testnet'} [opts.network] Network for address derivation (default mainnet).
 * @returns {{ valid: boolean, address?: string, publicKeyHex?: string, reason?: string }}
 */
function verifyStacksMessageSignature({ message, signature, publicKey, network = 'mainnet' }) {
  try {
    if (!message || !signature) {
      return { valid: false, reason: 'Missing message or signature' };
    }

    const sig = normalizeHex(signature);
    if (!/^[0-9a-f]{130}$/.test(sig)) {
      return { valid: false, reason: 'Signature must be 65 bytes of hex (130 characters)' };
    }

    const msgHash = hashMessage(message);

    // Recover the signer's public key from (messageHash, signature).
    const recovered = publicKeyFromSignatureRsv(msgHash, sig);
    const recoveredHex = normalizePublicKey(
      typeof recovered === 'string' ? recovered : Buffer.from(recovered).toString('hex')
    );

    // If the wallet also reported its public key, it must match the recovery.
    if (publicKey && normalizePublicKey(publicKey) !== recoveredHex) {
      return { valid: false, reason: 'Signature does not match the reported public key' };
    }

    const address = getAddressFromPublicKey(recoveredHex, network);
    if (!validateStacksAddress(address)) {
      return { valid: false, reason: 'Recovered an invalid Stacks address' };
    }

    return { valid: true, address, publicKeyHex: recoveredHex };
  } catch (err) {
    return { valid: false, reason: `Signature verification failed: ${err.message}` };
  }
}

module.exports = {
  hashMessage,
  verifyStacksMessageSignature,
  STACKS_MESSAGE_PREFIX
};
