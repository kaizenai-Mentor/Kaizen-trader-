const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hashMessage,
  verifyStacksMessageSignature,
  STACKS_MESSAGE_PREFIX
} = require('../utils/stacksSignature');

test('hashMessage uses the standard Stacks signed-message encoding', () => {
  assert.equal(STACKS_MESSAGE_PREFIX, '\x17Stacks Signed Message:\n');
  assert.equal(
    hashMessage('hello world'),
    '619997693db23de4b92ed152444a578a134143d9ad2c0f4dff2615de9d42ad96'
  );
});

test('verifyStacksMessageSignature recovers the signer from an official vector', () => {
  const message = 'You are saying that you want to perform action XYZ.';
  const publicKey = '024cce41b91566d70ec2ed6eb161c6ef9c277bdc034738318ed06f1d5ba09546d6';
  const signature =
    '29ef6d718235e5fc32a1b90dd8fc7fa9403fa1b55c2dce46374570b7f3a4815d' +
    '0215b8565f29a33ef8132dc0db6b00a5f13d85d6aff5c1171271818b9928928c01';

  const result = verifyStacksMessageSignature({
    message,
    signature,
    publicKey,
    network: 'testnet'
  });

  assert.equal(result.valid, true, result.reason);
  assert.equal(result.address, 'STGSJA8EMYDBAJDX6Z4ED8CWW071B6NB97SRAM1E');
  assert.equal(result.publicKeyHex, publicKey);
});

test('verifyStacksMessageSignature rejects a mismatched reported key', () => {
  const result = verifyStacksMessageSignature({
    message: 'You are saying that you want to perform action XYZ.',
    signature:
      '29ef6d718235e5fc32a1b90dd8fc7fa9403fa1b55c2dce46374570b7f3a4815d' +
      '0215b8565f29a33ef8132dc0db6b00a5f13d85d6aff5c1171271818b9928928c01',
    publicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    network: 'testnet'
  });

  assert.equal(result.valid, false);
  assert.match(result.reason, /reported public key/);
});
