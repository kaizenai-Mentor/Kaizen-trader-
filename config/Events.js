/**
 * Upcoming market events for the Forex Factory style Economic Calendar on Market News.
 *
 * Combines any pinned static events that are still in the future with the rolling
 * high-impact Forex Factory macro schedule from services/marketNews.js so the
 * calendar always shows active Red Folder (HIGH) and Orange Folder (MEDIUM) catalysts.
 */
const { getRollingForexFactoryEvents } = require('../services/marketNews');

const EVENTS = [
  {
    id: 'us-cpi',
    currency: 'USD',
    title: 'US CPI (YoY)',
    date: '2026-10-14T12:30:00Z',
    impact: 'HIGH',
    forecast: '3.2%',
    previous: '3.3%',
    note: 'Inflation print. Expect volatility on USD pairs.'
  }
];

function getActiveEvents(now = new Date()) {
  const activeStatic = EVENTS
    .filter((e) => new Date(e.date).getTime() > now.getTime())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const rolling = getRollingForexFactoryEvents(now);
  return [...activeStatic, ...rolling];
}

module.exports = { EVENTS, getActiveEvents };
