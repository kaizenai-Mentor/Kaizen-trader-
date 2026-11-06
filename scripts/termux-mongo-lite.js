/**
 * KAIZEN Termux Embedded MongoDB Wire-Protocol Server (Zero Native Binary Needed)
 *
 * Why this exists:
 * Installing the native C++ `mongodb` daemon (`mongod`) inside Android Termux is
 * unsupported by official Termux packages. This lightweight pure-Node wire server
 * speaks the MongoDB OP_MSG protocol on 127.0.0.1:27017 using `bson`, persists
 * documents to `.kaizen-local-db.json`, and seeds a ready-to-test trader account
 * (dennis@kaizen.test / kaizen123 with 12 logged sessions) so KAIZEN runs 100%
 * offline or locally inside Termux out of the box.
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { BSON, ObjectId } = require('bson');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(process.cwd(), '.kaizen-local-db.json');
const PORT = Number(process.env.MONGO_LITE_PORT || 27017);

const collections = new Map();

function getCol(name) {
  if (!collections.has(name)) collections.set(name, []);
  return collections.get(name);
}

function reviveDates(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_id' && typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) {
      out[k] = new ObjectId(v);
    } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) {
      out[k] = new Date(v);
    } else if (v && typeof v === 'object') {
      out[k] = reviveDates(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      for (const [colName, docs] of Object.entries(raw)) {
        if (Array.isArray(docs)) {
          collections.set(colName, docs.map(reviveDates));
        }
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function saveToDisk() {
  try {
    const dump = {};
    for (const [colName, docs] of collections.entries()) {
      if (colName === 'sessions') continue;
      dump[colName] = docs;
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dump, null, 2), 'utf8');
  } catch (e) {}
}

function matchValue(docVal, cond) {
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
    for (const [op, val] of Object.entries(cond)) {
      if (op === '$ne') {
        if (String(docVal) === String(val)) return false;
      } else if (op === '$in') {
        if (!Array.isArray(val) || !val.map(String).includes(String(docVal))) return false;
      } else if (op === '$nin') {
        if (Array.isArray(val) && val.map(String).includes(String(docVal))) return false;
      } else if (op === '$gte') {
        if (new Date(docVal) < new Date(val)) return false;
      } else if (op === '$lte') {
        if (new Date(docVal) > new Date(val)) return false;
      } else if (op === '$gt') {
        if (new Date(docVal) <= new Date(val)) return false;
      } else if (op === '$lt') {
        if (new Date(docVal) >= new Date(val)) return false;
      } else if (op === '$exists') {
        if (Boolean(val) !== (docVal !== undefined)) return false;
      }
    }
    return true;
  }
  if (docVal instanceof ObjectId || cond instanceof ObjectId) {
    return String(docVal) === String(cond);
  }
  return docVal === cond;
}

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
}

function matchesFilter(doc, filter = {}) {
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$or' && Array.isArray(v)) {
      if (!v.some((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    if (k === '$and' && Array.isArray(v)) {
      if (!v.every((sub) => matchesFilter(doc, sub))) return false;
      continue;
    }
    const val = getByPath(doc, k);
    if (!matchValue(val, v)) return false;
  }
  return true;
}

function setByPath(obj, pathStr, val) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

function applyUpdate(doc, update = {}) {
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) setByPath(doc, k, v);
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      setByPath(doc, k, (Number(getByPath(doc, k)) || 0) + Number(v));
    }
  }
  if (update.$push) {
    for (const [k, v] of Object.entries(update.$push)) {
      const arr = getByPath(doc, k) || [];
      if (v && v.$each && Array.isArray(v.$each)) arr.push(...v.$each);
      else arr.push(v);
      setByPath(doc, k, arr);
    }
  }
  for (const [k, v] of Object.entries(update)) {
    if (!k.startsWith('$')) doc[k] = v;
  }
}

async function seedDefaultTraderIfEmpty() {
  const users = getCol('users');
  if (users.length > 0) return;

  const userId = new ObjectId('672811112222333344445555');
  const passwordHash = await bcrypt.hash('kaizen123', 10);

  users.push({
    _id: userId,
    username: 'Dennis',
    email: 'dennis@kaizen.test',
    password: passwordHash,
    authMethod: 'password',
    isVerified: true,
    termsAcceptedAt: new Date(),
    disciplineScore: 78,
    streak: 9,
    badges: [
      { id: 'first_session', name: 'First Step', description: 'Logged first session', earnedAt: new Date() },
      { id: 'ten_sessions', name: 'Consistent 10', description: 'Logged 10 sessions', earnedAt: new Date() }
    ],
    brokerTrades: [
      {
        tradeHash: '0x99887766554433221100aabbccddeeff',
        instrument: 'AUDJPY',
        direction: 'Sell',
        openTime: new Date(Date.now() - 2 * 86400000),
        closeTime: new Date(Date.now() - 2 * 86400000),
        entryPrice: '101.420',
        stopLoss: '101.720',
        takeProfit: '100.820',
        exitPrice: '100.820',
        outcome: 'Win',
        rrAchieved: '1:2.0',
        importedAt: new Date()
      }
    ],
    createdAt: new Date(Date.now() - 30 * 86400000)
  });

  const systems = getCol('tradingsystems');
  systems.push({
    _id: new ObjectId(),
    userId,
    setups: [{ name: 'Daily Candlestick Liquidity', description: 'Previous daily candle high/low sweep with 30m/15m displacement.' }],
    entryRules: 'Wait for previous daily high/low liquidity sweep and 30m/15m displacement candle close.',
    riskRules: { riskPerTrade: '1%', dailyLossLimit: '2%', maxTradesPerDay: 2 },
    updatedAt: new Date()
  });

  const journals = getCol('journals');
  const sampleSessions = [
    { daysAgo: 14, asset: 'AUDJPY', type: 'LIVE', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Waited for London sweep of previous daily high on AUDJPY and entered sell after 30m displacement.', learned: 'Patience at the daily liquidity level gives the cleanest R:R.' },
    { daysAgo: 13, asset: 'Japan 225', type: 'STUDY', outcome: 'Win', compliant: true, emo: 'Focused', notes: 'Studied how continuation DCL trends unfold on Japan 225 across 4H and 30m structure.', learned: 'Multi-timeframe alignment keeps entries high probability.' },
    { daysAgo: 12, asset: 'EURUSD', type: 'LIVE', outcome: 'Loss', compliant: false, emo: 'Anxious', notes: 'Entered early on EURUSD before the 30m displacement candle closed and got stopped out.', learned: 'Never anticipate the displacement candle before the 30m body closes.' },
    { daysAgo: 11, asset: 'AUDJPY', type: 'LIVE', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Executed clean sell setup on AUDJPY following my Daily Candlestick Liquidity checklist.', learned: 'Following the checklist removes emotional hesitation.' },
    { daysAgo: 10, asset: 'XAUUSD', type: 'BACKTEST', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Backtested 5 New York sessions on XAUUSD testing the daily low sweep reaction.', learned: 'Gold respects the daily sweep best when DXY aligns.' },
    { daysAgo: 8, asset: 'GBPUSD', type: 'LIVE', outcome: 'Win', compliant: true, emo: 'Confident', notes: 'Took GBPUSD buy after previous day low sweep and 15m market structure shift.', learned: 'One clean setup per session is enough.' },
    { daysAgo: 7, asset: 'AUDJPY', type: 'LIVE', outcome: 'Loss', compliant: true, emo: 'Calm', notes: 'Valid DCL setup on AUDJPY that hit my predefined 1% stop loss. Walked away immediately.', learned: 'A rule-compliant loss is good trading process.' },
    { daysAgo: 5, asset: 'Japan 225', type: 'STUDY', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Chart study on Japan 225 Asian/London transition liquidity sweeps.', learned: 'Wait for the sweep of the Asian range before looking for continuation.' },
    { daysAgo: 4, asset: 'EURUSD', type: 'LIVE', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Corrected last week mistake on EURUSD by waiting for the full 30m candle close before entering.', learned: 'Waiting for the close saved me from a fakeout.' },
    { daysAgo: 2, asset: 'AUDJPY', type: 'LIVE', outcome: 'Win', compliant: true, emo: 'Calm', notes: 'Sold AUDJPY at 101.420 after the daily high sweep and rode it down to 100.820 target.', learned: 'Stick to AUDJPY and Japan 225 where my DCL edge is sharpest.' }
  ];

  for (const item of sampleSessions) {
    journals.push({
      _id: new ObjectId(),
      userId,
      asset: item.asset,
      sessionType: item.type,
      state: 'REFLECTED',
      outcome: item.outcome,
      ruleCompliance: item.compliant,
      emotionalState: item.emo,
      plan: {
        setup: 'Daily Candlestick Liquidity',
        riskPct: 1,
        maxTrades: 2,
        EmotionBefore: item.emo,
        skipped: false
      },
      execution: {
        tradesCount: 1,
        ruleChecks: { followedEntry: item.compliant, respectedRisk: true, respectedMaxTrades: true }
      },
      reflection: {
        learned: item.learned,
        improveNext: 'Keep executing only A+ Daily Candlestick Liquidity setups.',
        emotionAfter: 'Calm'
      },
      notes: item.notes,
      createdAt: new Date(Date.now() - item.daysAgo * 86400000),
      updatedAt: new Date(Date.now() - item.daysAgo * 86400000)
    });
  }

  saveToDisk();
}

function handleCommand(cmd) {
  if (cmd.hello || cmd.ismaster || cmd.isMaster) {
    return {
      ismaster: true,
      maxBsonObjectSize: 16777216,
      maxMessageSizeBytes: 48000000,
      maxWriteBatchSize: 100000,
      localTime: new Date(),
      minWireVersion: 0,
      maxWireVersion: 17,
      ok: 1
    };
  }
  if (cmd.ping || cmd.buildInfo || cmd.buildinfo || cmd.getLog || cmd.createIndexes || cmd.endSessions) {
    return { ok: 1 };
  }
  if (cmd.insert) {
    const col = getCol(cmd.insert);
    const docs = cmd.documents || [];
    for (const d of docs) {
      if (!d._id) d._id = new ObjectId();
      col.push(d);
    }
    saveToDisk();
    return { n: docs.length, ok: 1 };
  }
  if (cmd.find) {
    const col = getCol(cmd.find);
    let rows = col.filter((d) => matchesFilter(d, cmd.filter || {}));
    if (cmd.sort) {
      const sortEntries = Object.entries(cmd.sort);
      rows.sort((a, b) => {
        for (const [k, dir] of sortEntries) {
          const va = getByPath(a, k);
          const vb = getByPath(b, k);
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
        }
        return 0;
      });
    }
    if (cmd.skip) rows = rows.slice(cmd.skip);
    if (cmd.limit) rows = rows.slice(0, cmd.limit);
    return { cursor: { id: 0n, ns: `${cmd.$db || 'test'}.${cmd.find}`, firstBatch: rows }, ok: 1 };
  }
  if (cmd.count || cmd.countDocuments) {
    const colName = cmd.count || cmd.countDocuments;
    const col = getCol(colName);
    const rows = col.filter((d) => matchesFilter(d, cmd.query || cmd.filter || {}));
    return { n: rows.length, ok: 1 };
  }
  if (cmd.aggregate) {
    const col = getCol(cmd.aggregate);
    const pipeline = cmd.pipeline || [];
    let rows = [...col];
    for (const stage of pipeline) {
      if (stage.$match) rows = rows.filter((d) => matchesFilter(d, stage.$match));
      if (stage.$count) rows = [{ [stage.$count]: rows.length }];
    }
    return { cursor: { id: 0n, ns: `${cmd.$db || 'test'}.${cmd.aggregate}`, firstBatch: rows }, ok: 1 };
  }
  if (cmd.update) {
    const col = getCol(cmd.update);
    let n = 0;
    let nModified = 0;
    const upserted = [];
    for (const u of cmd.updates || []) {
      const matches = col.filter((d) => matchesFilter(d, u.q || {}));
      if (matches.length === 0 && u.upsert) {
        const doc = { _id: new ObjectId() };
        for (const [k, v] of Object.entries(u.q || {})) {
          if (!k.startsWith('$')) doc[k] = v;
        }
        applyUpdate(doc, u.u || {});
        col.push(doc);
        n++;
        upserted.push({ index: 0, _id: doc._id });
      } else {
        const targets = u.multi ? matches : matches.slice(0, 1);
        for (const t of targets) {
          applyUpdate(t, u.u || {});
          n++;
          nModified++;
        }
      }
    }
    saveToDisk();
    return { n, nModified, upserted, ok: 1 };
  }
  if (cmd.findAndModify || cmd.findandmodify) {
    const colName = cmd.findAndModify || cmd.findandmodify;
    const col = getCol(colName);
    const matches = col.filter((d) => matchesFilter(d, cmd.query || {}));
    if (cmd.remove) {
      if (matches.length > 0) {
        const idx = col.indexOf(matches[0]);
        if (idx >= 0) col.splice(idx, 1);
        saveToDisk();
        return { value: matches[0], ok: 1 };
      }
      return { value: null, ok: 1 };
    }
    let doc = matches[0] || null;
    if (!doc && cmd.upsert) {
      doc = { _id: new ObjectId() };
      for (const [k, v] of Object.entries(cmd.query || {})) {
        if (!k.startsWith('$')) doc[k] = v;
      }
      col.push(doc);
    }
    if (doc && cmd.update) {
      applyUpdate(doc, cmd.update);
      saveToDisk();
    }
    return { value: doc, ok: 1 };
  }
  if (cmd.delete) {
    const col = getCol(cmd.delete);
    let n = 0;
    for (const del of cmd.deletes || []) {
      const matches = col.filter((d) => matchesFilter(d, del.q || {}));
      const targets = del.limit === 1 ? matches.slice(0, 1) : matches;
      for (const t of targets) {
        const idx = col.indexOf(t);
        if (idx >= 0) {
          col.splice(idx, 1);
          n++;
        }
      }
    }
    saveToDisk();
    return { n, ok: 1 };
  }
  return { ok: 1 };
}

function buildOpMsgReply(requestId, doc) {
  const bsonBytes = BSON.serialize(doc);
  const totalLen = 16 + 4 + 1 + bsonBytes.length;
  const buf = Buffer.alloc(totalLen);
  buf.writeInt32LE(totalLen, 0);
  buf.writeInt32LE(Math.floor(Math.random() * 1000000), 4);
  buf.writeInt32LE(requestId, 8);
  buf.writeInt32LE(2013, 12);
  buf.writeUInt32LE(0, 16);
  buf.writeUInt8(0, 20);
  Buffer.from(bsonBytes).copy(buf, 21);
  return buf;
}

async function start() {
  loadFromDisk();
  await seedDefaultTraderIfEmpty();

  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const msgLen = buffer.readInt32LE(0);
        if (buffer.length < msgLen) break;
        const msg = buffer.subarray(0, msgLen);
        buffer = buffer.subarray(msgLen);
        const reqId = msg.readInt32LE(4);
        const opCode = msg.readInt32LE(12);
        if (opCode === 2013) {
          let offset = 20;
          let mainCmd = {};
          while (offset < msg.length) {
            const kind = msg.readUInt8(offset);
            offset += 1;
            if (kind === 0) {
              const docLen = msg.readInt32LE(offset);
              const doc = BSON.deserialize(msg.subarray(offset, offset + docLen));
              mainCmd = Object.assign(mainCmd, doc);
              offset += docLen;
            } else if (kind === 1) {
              const secLen = msg.readInt32LE(offset);
              const secEnd = offset + secLen;
              offset += 4;
              const cstrEnd = msg.indexOf(0, offset);
              const ident = msg.toString('utf8', offset, cstrEnd);
              offset = cstrEnd + 1;
              const arr = [];
              while (offset < secEnd) {
                const dLen = msg.readInt32LE(offset);
                arr.push(BSON.deserialize(msg.subarray(offset, offset + dLen)));
                offset += dLen;
              }
              mainCmd[ident] = arr;
            } else {
              break;
            }
          }
          const resDoc = handleCommand(mainCmd);
          socket.write(buildOpMsgReply(reqId, resDoc));
        } else if (opCode === 2004) {
          const replyBson = BSON.serialize({
            ismaster: true,
            maxBsonObjectSize: 16777216,
            maxMessageSizeBytes: 48000000,
            maxWriteBatchSize: 100000,
            localTime: new Date(),
            minWireVersion: 0,
            maxWireVersion: 17,
            ok: 1
          });
          const totalLen = 16 + 20 + replyBson.length;
          const buf = Buffer.alloc(totalLen);
          buf.writeInt32LE(totalLen, 0);
          buf.writeInt32LE(1, 4);
          buf.writeInt32LE(reqId, 8);
          buf.writeInt32LE(1, 12);
          buf.writeInt32LE(0, 16);
          buf.writeBigInt64LE(0n, 20);
          buf.writeInt32LE(0, 28);
          buf.writeInt32LE(1, 32);
          Buffer.from(replyBson).copy(buf, 36);
          socket.write(buf);
        }
      }
    });
    socket.on('error', () => {});
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[KAIZEN-DB] Local DB port 27017 already active.');
      process.exit(0);
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[KAIZEN-DB] Embedded Termux DB running on 127.0.0.1:${PORT} (saved to .kaizen-local-db.json)`);
  });
}

start();
