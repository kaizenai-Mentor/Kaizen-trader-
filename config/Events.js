/**
 * Upcoming market events for the events card on the Market News page.
 *
 * Events auto-expire: once an entry's date passes, it is dropped from the
 * card automatically. New entries are added at weekly maintenance — an
 * empty card between windows is expected and by design.
 */
const EVENTS = [
  {
    id: 'us-cpi',
    title: 'US CPI (YoY)',
    date: '2026-10-14T12:30:00Z',
    impact: 'HIGH',
    note: 'Inflation print — expect volatility on USD pairs.'
  }
];

function getActiveEvents(now = new Date()) {
  return EVENTS
    .filter((e) => new Date(e.date).getTime() > now.getTime())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

module.exports = { EVENTS, getActiveEvents };
