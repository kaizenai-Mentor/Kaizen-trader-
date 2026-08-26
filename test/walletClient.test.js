const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const walletSource = fs.readFileSync(
  path.join(__dirname, '../public/js/kaizen-wallet.js'),
  'utf8'
);

function element() {
  return {
    style: {},
    textContent: '',
    disabled: false,
    checked: false,
    listeners: {},
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    }
  };
}

async function loadWalletUi({ mobile, provider, fetchImpl, stacksConnect }) {
  const elements = {
    'kz-wallet-card': element(),
    'kz-wallet-connect-view': element(),
    'kz-wallet-connected-view': element(),
    'kz-wallet-connect-btn': element(),
    'kz-wallet-consent': element(),
    'kz-wallet-msg': element()
  };
  elements['kz-wallet-consent'].checked = true;

  const navigation = { assigned: null };
  const location = {
    href: 'https://kaizen.example/reputation',
    origin: 'https://kaizen.example',
    assign(url) {
      navigation.assigned = url;
    }
  };
  const window = {
    location,
    StacksConnect: stacksConnect,
    XverseProviders: provider ? { BitcoinProvider: provider } : undefined
  };
  window.window = window;

  vm.runInNewContext(walletSource, {
    window,
    document: { getElementById: id => elements[id] || null },
    navigator: {
      platform: mobile ? 'iPhone' : 'Linux x86_64',
      maxTouchPoints: mobile ? 5 : 0,
      userAgent: mobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile'
        : 'Mozilla/5.0 (X11; Linux x86_64)',
      userAgentData: { mobile }
    },
    fetch: fetchImpl,
    URL,
    console,
    setTimeout,
    clearTimeout
  });

  // Let the initial wallet-status request settle before clicking connect.
  await new Promise(resolve => setImmediate(resolve));
  return { elements, navigation };
}

test('mobile browsers hand off to Xverse before requesting a nonce', async () => {
  let fetches = 0;
  const ui = await loadWalletUi({
    mobile: true,
    provider: null,
    stacksConnect: {},
    fetchImpl: async url => {
      fetches++;
      assert.equal(url, '/api/wallet/status');
      return { json: async () => ({ connected: false }) };
    }
  });

  await ui.elements['kz-wallet-connect-btn'].listeners.click();

  assert.equal(fetches, 1);
  assert.match(
    ui.navigation.assigned,
    /^https:\/\/connect\.xverse\.app\/browser\?url=/
  );
  const target = new URL(ui.navigation.assigned).searchParams.get('url');
  assert.equal(new URL(target).searchParams.get('wallet'), 'xverse');
  assert.equal(ui.elements['kz-wallet-connect-btn'].textContent, 'Opening Xverse…');
});

test('Xverse receives its public key in the stx_signMessage request', async () => {
  const calls = [];
  const publicKey = `02${'ab'.repeat(32)}`;
  const signature = 'cd'.repeat(65);
  const stacksConnect = {
    async connect(options) {
      calls.push(['connect', options]);
      return { addresses: [{ address: 'SP123', publicKey }] };
    },
    async request(method, params) {
      calls.push(['request', method, params]);
      return { signature, publicKey };
    }
  };

  const ui = await loadWalletUi({
    mobile: false,
    provider: {},
    stacksConnect,
    fetchImpl: async (url, options) => {
      if (url === '/api/wallet/status') {
        return { json: async () => ({ connected: false }) };
      }
      if (url === '/api/wallet/nonce') {
        return {
          ok: true,
          json: async () => ({ nonce: 'nonce', message: 'message', network: 'mainnet' })
        };
      }
      if (url === '/api/wallet/verify') {
        const body = JSON.parse(options.body);
        assert.equal(body.publicKey, publicKey);
        assert.equal(body.signature, signature);
        return { ok: true, json: async () => ({ connected: true, wallet: {} }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }
  });

  await ui.elements['kz-wallet-connect-btn'].listeners.click();

  assert.equal(calls[0][0], 'connect');
  assert.equal(calls[0][1].network, 'mainnet');
  assert.equal(calls[1][0], 'request');
  assert.equal(calls[1][1], 'stx_signMessage');
  assert.equal(calls[1][2].message, 'message');
  assert.equal(calls[1][2].publicKey, publicKey);
});

test('Xverse fallback still returns the connected public key', async () => {
  const calls = [];
  const publicKey = `02${'ef'.repeat(32)}`;
  const signature = '12'.repeat(65);
  const stacksConnect = {
    async connect() {
      calls.push(['connect']);
      return { addresses: [{ address: 'SP456', publicKey }] };
    },
    async request(method, params) {
      calls.push(['request', method, params]);
      if (calls.length === 2) throw new Error('publicKey parameter unsupported');
      return { signature };
    }
  };

  const ui = await loadWalletUi({
    mobile: false,
    provider: {},
    stacksConnect,
    fetchImpl: async (url, options) => {
      if (url === '/api/wallet/status') {
        return { json: async () => ({ connected: false }) };
      }
      if (url === '/api/wallet/nonce') {
        return {
          ok: true,
          json: async () => ({ nonce: 'nonce', message: 'message', network: 'mainnet' })
        };
      }
      if (url === '/api/wallet/verify') {
        const body = JSON.parse(options.body);
        assert.equal(body.publicKey, publicKey);
        assert.equal(body.signature, signature);
        return { ok: true, json: async () => ({ connected: true, wallet: {} }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }
  });

  await ui.elements['kz-wallet-connect-btn'].listeners.click();

  assert.equal(calls.length, 3);
  assert.equal(calls[2][1], 'stx_signMessage');
  assert.equal(calls[2][2].publicKey, undefined);
});
