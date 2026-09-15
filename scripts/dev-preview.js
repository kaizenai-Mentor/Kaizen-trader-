/**
 * KAIZEN local preview — runs the app for reviewing the public pages.
 *
 * Usage: node scripts/dev-preview.js
 *
 * Tries an in-memory MongoDB first (full app experience). If the mongod
 * binary can't be downloaded (restricted network), falls back to no-DB
 * mode: the server runs, all public pages render normally, and any
 * database-dependent routes are expected to fail/hang until a real
 * MONGODB_URI is provided.
 *
 * Local development only. Production (Render) uses `npm start`.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'dev-preview-secret';

async function withMemoryDb() {
  const { MongoMemoryServer } = require('mongodb-memory-server-core');
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('kaizen-preview');
  console.log('[dev-preview] in-memory MongoDB ready:', process.env.MONGODB_URI);
  return mongod;
}

(async () => {
  let mongod = null;
  try {
    mongod = await withMemoryDb();
  } catch (err) {
    console.warn('[dev-preview] in-memory MongoDB unavailable (' + err.code + ').');
    console.warn('[dev-preview] falling back to NO-DB mode — public pages only.');
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/kaizen-preview';

    // Stub config/db BEFORE the server loads, so mongoose never attempts
    // a real connection (a failed connect leaves pool errors that crash
    // the process). Public pages never touch the DB; DB-dependent routes
    // are expected to fail instead.
    const dbPath = require.resolve('../config/db.js');
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: async function connectDB() {
        console.log('[dev-preview] connectDB stubbed — running without a database.');
      }
    };

    // Safety nets for no-DB preview mode: connect-mongo's session store
    // eagerly opens its own MongoClient, and its failed connection promise
    // is an unhandled (fatal in Node 22) rejection. Shield both so the
    // page server stays alive.
    let noise = 0;
    const quiet = (kind, info) => {
      noise++;
      if (noise <= 5) {
        console.warn('[dev-preview] ' + kind + ' suppressed (no-DB preview mode):', info);
      }
    };
    process.on('unhandledRejection', (reason) => {
      quiet('unhandledRejection', reason && reason.message ? reason.message : String(reason));
    });
    process.on('uncaughtException', (err) => {
      quiet('uncaughtException', err && err.message ? err.message : String(err));
    });
    let suppressed = 0;
    process.exit = (code) => {
      suppressed++;
      if (suppressed <= 2) {
        console.warn('[dev-preview] process.exit(' + code + ') suppressed (no-DB preview mode).');
      }
    };
  }

  try {
    require('../server.js');
  } catch (err) {
    console.error('[dev-preview] failed to start:', err);
    process.exit(1);
  }

  if (mongod) {
    const shutdown = async () => {
      try { await mongod.stop(); } catch (e) { /* ignore */ }
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
})();
