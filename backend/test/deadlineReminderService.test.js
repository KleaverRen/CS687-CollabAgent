const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");

const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "config/database.js");
let cleanupRequireCache = null;

function loadDeadlineServiceWithPool(fakePool) {
  const dbCacheKey = require.resolve(dbPath);
  const notificationServicePath = path.join(
    root,
    "services/notificationService.js",
  );
  const deadlineServicePath = path.join(
    root,
    "services/deadlineReminderService.js",
  );
  const notificationServiceCacheKey = require.resolve(notificationServicePath);
  const deadlineServiceCacheKey = require.resolve(deadlineServicePath);

  const originalDbCache = require.cache[dbCacheKey];
  const originalNotificationCache = require.cache[notificationServiceCacheKey];
  const originalDeadlineCache = require.cache[deadlineServiceCacheKey];

  require.cache[dbCacheKey] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: fakePool,
  };

  delete require.cache[notificationServiceCacheKey];
  delete require.cache[deadlineServiceCacheKey];

  cleanupRequireCache = () => {
    if (originalDbCache) require.cache[dbCacheKey] = originalDbCache;
    else delete require.cache[dbCacheKey];

    if (originalNotificationCache) {
      require.cache[notificationServiceCacheKey] = originalNotificationCache;
    } else {
      delete require.cache[notificationServiceCacheKey];
    }

    if (originalDeadlineCache) {
      require.cache[deadlineServiceCacheKey] = originalDeadlineCache;
    } else {
      delete require.cache[deadlineServiceCacheKey];
    }

    cleanupRequireCache = null;
  };

  return require(deadlineServicePath);
}

afterEach(() => {
  if (cleanupRequireCache) cleanupRequireCache();
});

test("findTasksInWindow excludes done tasks case-insensitively", async () => {
  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const service = loadDeadlineServiceWithPool(fakePool);

  await service.findTasksInWindow(service.REMINDER_WINDOWS[0]);

  assert.match(
    calls[0].sql,
    /COALESCE\(LOWER\(TRIM\(t\.status\)\), ''\) <> 'done'/,
  );
});

test("overdue reminder window searches only past deadlines", async () => {
  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };
  const service = loadDeadlineServiceWithPool(fakePool);
  const overdueWindow = service.REMINDER_WINDOWS.find(
    (window) => window.label === "overdue",
  );

  await service.findTasksInWindow(overdueWindow);

  assert.match(calls[0].sql, /t\.deadline >= NOW\(\) - \$2::interval/);
  assert.match(calls[0].sql, /t\.deadline <= NOW\(\) - \$1::interval/);
  assert.deepEqual(calls[0].params, ["0", "7 days"]);
});
