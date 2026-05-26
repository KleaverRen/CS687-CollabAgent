const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const dbPath = path.join(root, 'config/database.js');

function loadServiceWithPool(fakePool) {
  delete require.cache[require.resolve(dbPath)];
  require.cache[require.resolve(dbPath)] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: fakePool,
  };

  const servicePath = path.join(root, 'services/notificationService.js');
  delete require.cache[require.resolve(servicePath)];
  return require(servicePath);
}

test('clampLimit constrains pagination limits', () => {
  const service = loadServiceWithPool({ query: async () => ({ rows: [] }) });

  assert.equal(service.clampLimit(undefined), 25);
  assert.equal(service.clampLimit('0'), 1);
  assert.equal(service.clampLimit('250'), 100);
  assert.equal(service.clampLimit('10'), 10);
});

test('listNotifications scopes results to one user and unread filter', async () => {
  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ id: 'notification-1', title: 'Task assigned' }] };
    },
  };
  const service = loadServiceWithPool(fakePool);

  const rows = await service.listNotifications('user-1', { limit: 5, unreadOnly: true });

  assert.equal(rows.length, 1);
  assert.equal(calls[0].params[0], 'user-1');
  assert.equal(calls[0].params.at(-1), 5);
  assert.match(calls[0].sql, /n\.user_id = \$1/);
  assert.match(calls[0].sql, /n\.read_at IS NULL/);
});

test('markAllNotificationsRead only mutates unread rows for the authenticated user', async () => {
  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rowCount: 3, rows: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }] };
    },
  };
  const service = loadServiceWithPool(fakePool);

  const count = await service.markAllNotificationsRead('user-2');

  assert.equal(count, 3);
  assert.deepEqual(calls[0].params, ['user-2']);
  assert.match(calls[0].sql, /WHERE user_id = \$1 AND read_at IS NULL/);
});
