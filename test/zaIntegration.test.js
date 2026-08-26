const assert = require('node:assert/strict');
const test = require('node:test');

const zaClient = require('../config/za');
const {
  getBounties,
  selectZaUser
} = require('../controllers/zaController');

test('normalizes a ZA host or bounty endpoint to the JSON API base', () => {
  assert.equal(
    zaClient.normalizeBaseUrl('https://zeroauthoritydao.com'),
    'https://zeroauthoritydao.com/api'
  );
  assert.equal(
    zaClient.normalizeBaseUrl('https://zeroauthoritydao.com/api/'),
    'https://zeroauthoritydao.com/api'
  );
  assert.equal(
    zaClient.normalizeBaseUrl('https://zeroauthoritydao.com/api/bounties'),
    'https://zeroauthoritydao.com/api'
  );
});

test('reads the live ZA collection response shapes', () => {
  const bounty = { id: 'bounty-1' };
  const user = { id: 'user-1' };

  assert.deepEqual(
    zaClient.extractCollection({ data: [bounty] }, ['data', 'bounties']),
    [bounty]
  );
  assert.deepEqual(
    zaClient.extractCollection({ users: [user] }, ['users', 'data']),
    [user]
  );
  assert.deepEqual(
    zaClient.extractCollection({ data: { users: [user] } }, ['users', 'data']),
    [user]
  );
  assert.deepEqual(
    zaClient.extractEntity({ data: bounty }, ['data', 'bounty']),
    bounty
  );
});

test('bounties controller uses the JSON endpoint and data envelope', async () => {
  const originalGet = zaClient.get;
  let requestedPath;
  let rendered;
  const bounty = { id: 'bounty-1', name: 'Discipline challenge' };

  zaClient.get = async path => {
    requestedPath = path;
    return { data: { data: [bounty] } };
  };

  try {
    await getBounties(
      { session: { user: { id: 'kaizen-user' } } },
      { render(view, model) { rendered = { view, model }; } }
    );
  } finally {
    zaClient.get = originalGet;
  }

  assert.equal(requestedPath, '/bounties');
  assert.equal(rendered.view, 'bounties');
  assert.deepEqual(rendered.model.bounties, [bounty]);
  assert.equal(rendered.model.error, null);
});

test('matches a ZA profile by stored id or normalized username', () => {
  const results = [
    { id: 'other', username: 'other' },
    { id: 'za-123', username: 'kaizen_trader' }
  ];

  assert.equal(
    selectZaUser(results, { zaUserId: 'za-123', username: 'different' }).id,
    'za-123'
  );
  assert.equal(
    selectZaUser(results, { zaUserId: '', username: 'kaizen-trader' }).id,
    'za-123'
  );
});
