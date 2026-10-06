/**
 * KAIZEN review renders — app pages with demo data (owner design review).
 *
 * Renders the REAL EJS templates with demo data so login-walled pages can
 * be reviewed without a database (e.g. for the static GitHub Pages
 * snapshot in docs/). Nothing here touches production routes or data.
 *
 * Usage:  node scripts/render-review-pages.js [outDir]   (default /tmp/app-pages)
 */
const path = require('path');
const ejs = require(path.join(__dirname, '..', 'node_modules', 'ejs'));
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');
const OUT = process.argv[2] || '/tmp/app-pages';
fs.mkdirSync(OUT, { recursive: true });

// ── demo sessions (shape mirrors test/scoreEngine.test.js factory) ──
function mk(o = {}, i = 0) {
  const day = 16 - i;
  return Object.assign({
    _id: 'id' + i,
    createdAt: new Date(Date.UTC(2026, 8, day, 9)),
    sessionType: ['LIVE', 'LIVE', 'BACKTEST', 'STUDY'][i % 4],
    state: 'ANALYZED',
    asset: ['XAUUSD', 'BTCUSD', 'EURJPY', 'NAS100'][i % 4],
    notes: 'Clean session, executed the plan. Waited for the sweep and MSS confirmation before entry.',
    emotion: 'Calm',
    outcome: i % 3 === 0 ? 'Win' : (i % 3 === 1 ? 'Loss' : 'Breakeven'),
    ruleCompliance: !(i === 3 || i === 7 || i === 11),
    plan: { setup: '4H sweep → 30min MSS', skipped: false, emotionalState: 'CALM', confidence: 7 },
    quickChecks: (i === 3 || i === 7 || i === 11)
      ? { followedPlan: 'NO', withinEntryCriteria: 'NO', respectedRisk: 'YES' }
      : { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
    reflection: {
      whatHappened: 'Entered as planned and held through the squeeze.',
      followedProcess: 'Yes, fully this time.',
      learned: 'The five-minute timer works when it matters most.',
      wouldChange: 'Nothing this time.'
    },
    evidenceFlags: {}
  }, o);
}
const sessionsAsc = Array.from({ length: 14 }, (_, i) => mk({}, i));
const sessions = [...sessionsAsc].reverse();
const scoreEngine = require(path.join(ROOT, 'services', 'scoreEngine'));
const score = scoreEngine.computeScore(sessionsAsc, null, null);

const DIMENSION_LABELS = {
  process: 'Process', risk: 'Risk', execution: 'Execution',
  behavior: 'Behavior', learning: 'Learning & Consistency'
};

const user = {
  id: 'u1', username: 'Kaizen', email: 'kaizen@example.com',
  streak: 6, badges: ['first_session', 'streak_5'], disciplineScore: 72,
  createdAt: new Date('2026-06-01')
};

const system = {
  name: 'My Trading System', version: 3,
  marketConditions: 'London open — indices and metals only',
  tradingHours: '08:00–11:00 GMT',
  setups: [{ name: '4H sweep → 30min MSS' }, { name: 'Range fakeout' }],
  entryRules: 'MSS on 30min after liquidity sweep; no entry without confirmation candle close.',
  exitRules: '2R fixed or structure invalidation.',
  riskRules: { riskPerTrade: '1', maxPositionSize: '2 lots', dailyDrawdown: '3', maxDailyTrades: '2' },
  positionRules: '', noTradeConditions: ['News within 30min'], psychologicalRules: ['No trading after two losses'],
  savedAt: new Date(), changeNote: 'Tightened daily trades',
  history: [
    { version: 1, savedAt: new Date('2026-08-01'), changeNote: 'First system — built during onboarding.' },
    { version: 2, savedAt: new Date('2026-08-20'), changeNote: 'Added no-trade conditions.' },
    { version: 3, savedAt: new Date('2026-09-10'), changeNote: 'Tightened daily trades to 2.' }
  ]
};

const todayActions = [
  { title: 'You have no analyzed session in the last 24h', body: 'The loop compounds when it runs daily.', cta: 'Plan a session', href: '/dashboard/sessions/new' },
  { title: 'Review your last lesson', body: 'Re-read what your last session taught you.', cta: 'Open session', href: '/dashboard/sessions/abc' }
];
const nextMilestone = { label: '25 sessions logged', progress: 56, remaining: 11 };

const psychThreads = [
  { _id: 't1', kind: 'psychology', title: 'Fear of pulling the trigger', lastMessageAt: new Date(), messageCount: 8,
    messages: [
      { role: 'user', text: 'I see the setup perfectly but I freeze before clicking.', createdAt: new Date() },
      { role: 'kaizen', text: 'That freeze is data. Let\'s look at when it started.', createdAt: new Date() }
    ] },
  { _id: 't2', kind: 'psychology', title: 'Pressure from needing income', lastMessageAt: new Date(), messageCount: 5, messages: [] }
];
const mindState = {
  themes: [
    { name: 'Performance anxiety', status: 'improving', note: 'Linked to position size, not setup quality.', firstSeen: new Date('2026-07-02'), lastSeen: new Date(), occurrences: 9 },
    { name: 'Overconfidence after wins', status: 'active', note: 'Appears after 2+ green days.', firstSeen: new Date('2026-08-10'), lastSeen: new Date(), occurrences: 4 }
  ],
  situations: [{ situation: 'Trading during London open', note: 'Highest focus window.' }],
  strengths: [{ what: 'Honest reflection habit', note: 'Rare and valuable.' }],
  updatedAt: new Date()
};

const aiThreads = [
  { _id: 'k1', title: 'Why did I move my stop?', lastMessageAt: new Date(), messageCount: 6 },
  { _id: 'k2', title: 'Backtest vs live gap', lastMessageAt: new Date(), messageCount: 4 }
];

const progress = require(path.join(ROOT, 'services', 'progress'));
const snapshots = sessionsAsc.map((s, i) => ({
  computedAt: s.createdAt, overall: 48 + i * 2, overallState: 'READY',
  dimensions: {
    process: { score: 50 + i * 2 }, risk: { score: 55 + i * 2 },
    execution: { score: 45 + i * 2 }, behavior: { score: 52 + i * 2 },
    learning: { score: 60 + i * 2 }
  }
}));
const points = progress.timeline(snapshots);
const move = progress.movement(snapshots, 30);
const typePerf = progress.typePerformance(sessionsAsc);
const weekly = require(path.join(ROOT, 'services', 'weekly'));
const stats = weekly.weekStats(sessionsAsc);
const earned = weekly.badgesThisWeek(user.badges.map(b => ({ name: b, earnedAt: new Date() })), new Date(Date.now() - 7 * 864e5));

const letter = `You ran the loop 14 times this week — 11 of them inside your rules.

The number that matters most this week: after a loss, you broke plan in 1 of 3
sessions. That window is where KAIZEN watches closest, and it is improving.

MindState note: performance anxiety is marked improving — you reported the
freeze twice and waited for confirmation both times. That is the work showing
up in Behavior, not in words.

Next week, one focus: protect the streak on Monday. Your compliance dips
after weekends.`;

const leaders = [
  { username: 'SilentGrind', disciplineScore: 91, totalSessions: 214, streak: 41 },
  { username: 'TokyoRange', disciplineScore: 84, totalSessions: 133, streak: 12 },
  { username: 'Kaizen', disciplineScore: 72, totalSessions: 48, streak: 6 },
  { username: 'LondonOpen', disciplineScore: 68, totalSessions: 76, streak: 3 }
];

const mantleEvents = { scores: 3, patterns: 0, milestones: 2, total: 5 };
const mantleRecent = [
  { kind: 'score', txHash: '0x09afa48f904490f0154a670e94e2ae8bc0bfde822a1b4ec5d6d11c1e8c0df81a', previousScore: 51, newScore: 52, reason: 'Compliant session', timestamp: 1789527279000 },
  { kind: 'milestone', txHash: '0xabc', milestoneType: '10_sessions', score: 55, timestamp: 1789500000000 }
];

const zaData = { id: 'ZA-1042', name: 'Kaizen', xp: 3200, rank: 'Specialist', endorsements: 7, bounties: 4 };

const pages = {
  'dashboard': {
    user, sessions: sessions.slice(0, 5), score, dimensionLabels: DIMENSION_LABELS,
    todayActions, predictiveWarning: { message: 'Five consecutive sessions inside your rules. Your discipline is building — protect this streak today.', level: 'positive' },
    nextMilestone, totalSessions: 48, newBadges: null, streak: 6, badgeCount: 2,
    showCutover: false, showIntro: false, systemVersion: 3, title: 'Cockpit'
  },
  'sessions': { user, sessions, openPlan: null, system, title: 'Sessions' },
  'session-plan': { user, system, type: 'LIVE', title: 'New Session — The Plan' },
  'psychology': { user, mode: 'index', threads: psychThreads, mindState, openers: ['What is on your mind before today\'s session?', 'You mentioned pressure last time — how has that evolved?'], title: 'Psychology' },
  'kaizen-ai': { user, mode: 'index', threads: aiThreads, openers: ['Quiz me on my rules', 'Where does my discipline break most?'], aiResponse: null, title: 'KAIZEN AI' },
  'leaderboard': {
    user, fullUser: user, points, move, typePerf, totalSessions: 48,
    nextMilestone: progress.nextSessionMilestone(48),
    sparkPoints: progress.sparklinePoints(points, 300, 64),
    dimensionLabels: DIMENSION_LABELS, streak: 6, badges: user.badges,
    allTimeLeaders: leaders, weeklyLeaders: [leaders[1], leaders[2], leaders[3]],
    title: 'My Progress'
  },
  'weekly-summary': {
    user, stats, move, letter, letterCached: false, earned, streak: 6,
    weekStart: new Date(Date.now() - 7 * 864e5), dimensionLabels: DIMENSION_LABELS, title: 'Weekly Report'
  },
  'trading-system': { user, system, saved: false, title: 'My Trading System' },
  'reputation': {
    user, profileUser: user, disciplineScore: 72, totalSessions: 48, streak: 6,
    mantleEvents, mantleUserStats: { currentScore: 72, sessionCount: 48, milestoneCount: 2 },
    mantleRecent, mantleNote: null, mantleNetwork: 'Mantle Sepolia (testnet)',
    mantleExplorer: 'https://sepolia.mantlescan.xyz/address/0x65fe9Ccd1701C680fb137dD9f0D571d9045c5A0E',
    zaData, reputation: zaData, linkError: null, linkSuccess: true, title: 'Wallets & Verification'
  }
};

// ── stage pages + memories ──
const plannedSession = Object.assign(mk({}, 0), {
  _id: 'plan1', state: 'PLANNED', sessionType: 'LIVE', asset: 'General',
  notes: '', emotion: 'Focused',
  plan: { setup: '4H sweep → 30min MSS', entryCondition: 'MSS close after liquidity sweep', invalidation: 'Sweep fails below range low', predefinedRisk: '1% — 2 lots max', emotionalState: 'CALM', confidence: 7, skipped: false, systemVersion: 3, createdAt: new Date() },
  outcome: undefined, ruleCompliance: undefined, quickChecks: {}, reflection: undefined
});
const recordedSession = Object.assign(mk({}, 1), {
  _id: 'rec1', state: 'RECORDED', sessionType: 'LIVE', asset: 'XAUUSD',
  notes: 'Waited for the London sweep, MSS confirmed on the 30min, entered on the retest. Held through the squeeze to 2R. Felt the urge to add at +1.5R but sized in properly at the start, so no add.',
  quickChecks: { followedPlan: 'YES', withinEntryCriteria: 'YES', respectedRisk: 'YES' },
  outcome: 'Win', rrAchieved: '2R'
});
const analyzedSession = sessions[0];
const memories = [
  { type: 'session', asset: 'XAUUSD', sessionData: 'London sweep + MSS, entered on retest, held to 2R.', response: 'Strong execution. The patience after the sweep is exactly the behavior to repeat. Note the urge to add size at +1.5R — log what you felt there.', sessionScore: 82, createdAt: new Date(Date.now() - 2 * 864e5) },
  { type: 'session', asset: 'BTCUSD', sessionData: 'Entered before MSS confirmation.', response: 'The entry came before your trigger fired. Same setup, one candle early. The five-minute timer exists for exactly this moment.', sessionScore: 48, createdAt: new Date(Date.now() - 5 * 864e5) },
  { type: 'psych', asset: '—', sessionData: 'Froze before clicking on a perfect setup.', response: 'The freeze is data, not failure. It appeared after two losses — we will watch that window together.', sessionScore: null, createdAt: new Date(Date.now() - 8 * 864e5) }
];

pages['session-record'] = { user, session: plannedSession, title: 'The Record' };
pages['session-reflect'] = { user, session: recordedSession, title: 'The Reflection' };
pages['session-detail'] = { user, session: Object.assign({}, analyzedSession, { aiAnalysis: 'Your entry timing improved on this one — the confirmation candle closed before you acted, and that patience is what moved Execution up. The loss itself is noise; the process that produced it is signal. One thing to watch: your confidence was a 7 pre-session but your reflection says you almost added size at +1.5R. That gap between declared confidence and in-trade impulses is exactly what the after-loss window tracks. Keep logging that urge honestly — it is the raw material for the next improvement.' }), score: scoreEngine.computeScore([analyzedSession], null, null), title: 'Session' };
pages['memories'] = { user, memories, title: 'Memories' };

const ANNOUNCEMENT = {
  message: '<b>KAIZEN V2 IS COMING</b> — the score gets five dimensions · plan → record → reflect sessions · your own Trading System · rolling out over the next 30 days'
};

(async () => {
  const results = [];
  for (const [name, data] of Object.entries(pages)) {
    try {
      const html = await ejs.renderFile(
        path.join(VIEWS, name + '.ejs'),
        Object.assign({ announcement: ANNOUNCEMENT }, data)
      );
      fs.writeFileSync(path.join(OUT, name + '.html'), html);
      results.push('OK   ' + name);
    } catch (err) {
      results.push('FAIL ' + name + ' :: ' + err.message.split('\n')[0]);
    }
  }
  console.log(results.join('\n'));
})();
