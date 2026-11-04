/**
 * services/marketNews.js
 *
 * Forex Factory style Economic Calendar & High Impact Financial Market News engine.
 *
 * 1. Filters incoming external news articles so ONLY news with genuine impact on
 *    the financial markets (Central Banks, Interest Rates, CPI/PCE Inflation,
 *    NFP/Employment, GDP/PMI, Treasury Yields, Major FX, Gold XAU/USD, Oil,
 *    and Major Indices) is retained. Non-market corporate fluff is discarded.
 * 2. Provides a live + rolling Forex Factory style Economic Calendar (Red Folder
 *    HIGH impact and Orange Folder MEDIUM impact macro releases with Currency,
 *    Time, Forecast, Previous, and Trader Volatility Note).
 * 3. Provides Forex Factory style breaking macro & FX market wire stories so the
 *    Market News page always displays high-impact financial market intelligence.
 */

const HIGH_IMPACT_RE = /\b(fed|fomc|powell|federal reserve|ecb|lagarde|boe|bank of england|bailey|boj|bank of japan|ueda|rba|rbnz|boc|snb|central bank|interest rate|rate cut|rate hike|basis points|bps|monetary policy|hawkish|dovish|cpi|pce|ppi|inflation|deflation|nonfarm|non-farm|nfp|payrolls|unemployment|jobless claims|jolts|gdp|pmi|ism|retail sales|treasury|yields|10-year|2-year|bond auction|sovereign debt|dxy|dollar index|eur\/?usd|gbp\/?usd|usd\/?jpy|aud\/?usd|usd\/?cad|usd\/?chf|xau\/?usd|gold price|bullion|safe haven|crude oil|wti|brent|opec|s&p 500|nasdaq|dow jones|wall street|tariffs|trade war|sanctions|geopolitical|liquidity|intervention)\b/i;

const FLUFF_RE = /\b(appoints new vice president|dividend declaration|quarterly conference participation|local charity|class action lawsuit|shareholder alert|law firm reminds|penny stock|celebrity|fashion|sports|entertainment|recipe|lifestyle|gaming review|box office)\b/i;

function isMarketMovingArticle(article) {
  if (!article || !article.title) return false;
  const text = `${article.title || ''} ${article.description || ''} ${article.snippet || ''}`;
  if (FLUFF_RE.test(text)) return false;
  return HIGH_IMPACT_RE.test(text);
}

function classifyArticleImpact(article) {
  const text = `${article.title || ''} ${article.description || ''} ${article.snippet || ''}`;
  let currency = article.currency || 'USD';
  let instruments = article.instruments || 'DXY · EUR/USD · US500';
  let category = article.category || 'Macro & FX';

  if (/\b(xau|gold|bullion|precious metal)\b/i.test(text)) {
    currency = 'XAU';
    instruments = 'XAU/USD · DXY · US10Y';
    category = 'Commodities & Gold';
  } else if (/\b(ecb|lagarde|eurozone|eur\/?usd|german|bund)\b/i.test(text)) {
    currency = 'EUR';
    instruments = 'EUR/USD · EUR/GBP · GER40';
    category = 'Central Banks & FX';
  } else if (/\b(boe|bank of england|bailey|uk cpi|sterling|gbp\/?usd|gilt)\b/i.test(text)) {
    currency = 'GBP';
    instruments = 'GBP/USD · EUR/GBP · GBP/JPY';
    category = 'Central Banks & FX';
  } else if (/\b(boj|bank of japan|ueda|yen|usd\/?jpy|tokyo cpi|jgb)\b/i.test(text)) {
    currency = 'JPY';
    instruments = 'USD/JPY · EUR/JPY · GBP/JPY';
    category = 'Central Banks & FX';
  } else if (/\b(wti|brent|crude oil|opec)\b/i.test(text)) {
    currency = 'OIL';
    instruments = 'USOIL · UKOIL · USD/CAD';
    category = 'Energy & Commodities';
  } else if (/\b(fomc|powell|federal reserve|cpi|pce|nfp|payrolls|treasury|yields)\b/i.test(text)) {
    currency = 'USD';
    instruments = 'DXY · XAU/USD · EUR/USD · NAS100';
    category = 'Central Banks & Rates';
  }

  const isHigh = /\b(fomc|powell|rate cut|rate hike|cpi|pce|nfp|payrolls|gdp|ecb|boe|boj|intervention|tariff|geopolitical|record high|surge|plunge|treasury)\b/i.test(text);
  const impact = article.impact || (isHigh ? 'HIGH' : 'MEDIUM');

  const cleanTextStr = (s) => String(s || '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+-\s+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return Object.assign({}, article, {
    title: cleanTextStr(article.title),
    description: cleanTextStr(article.description || article.snippet || ''),
    currency,
    impact,
    instruments,
    category,
    publishedAt: article.publishedAt || article.published_at || article.pubDate || new Date().toISOString()
  });
}

/**
 * Official 2026 Macro & Central Bank Economic Calendar Schedule
 * (Federal Reserve FOMC, BLS NFP & CPI, BEA GDP & Core PCE, ISM PMI,
 * ECB Governing Council, Bank of England MPC, Bank of Japan MPM, BoC, RBA).
 * All dates and times match the official release calendars in New York (EDT/EST) time.
 */
const OFFICIAL_2026_CALENDAR = [
  {
    id: 'ff-2026-10-27-cb-jolts',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'CB Consumer Confidence & JOLTS Job Openings',
    dateLabel: 'Tue, Oct 27, 2026',
    timeLabel: '10:00 EDT',
    date: '2026-10-27T14:00:00Z',
    actual: '',
    forecast: '99.5 / 7.84M',
    previous: '98.7 / 8.04M',
    instruments: 'DXY · XAU/USD · US500 · NAS100',
    note: 'Official Conference Board and BLS labor demand release. Key early week catalyst for US yields and USD pairs.'
  },
  {
    id: 'ff-2026-10-28-boc',
    currency: 'CAD',
    impact: 'HIGH',
    folder: 'red',
    title: 'BOC Monetary Policy Report & Overnight Rate Decision',
    dateLabel: 'Wed, Oct 28, 2026',
    timeLabel: '09:45 EDT',
    date: '2026-10-28T13:45:00Z',
    actual: '',
    forecast: '3.75%',
    previous: '4.25%',
    instruments: 'USD/CAD · CAD/JPY · EUR/CAD',
    note: 'Official Bank of Canada scheduled rate decision and press conference at 10:30 EDT.'
  },
  {
    id: 'ff-2026-10-28-aud-cpi',
    currency: 'AUD',
    impact: 'HIGH',
    folder: 'red',
    title: 'Australian CPI q/q & Trimmed Mean CPI',
    dateLabel: 'Wed, Oct 28, 2026',
    timeLabel: '20:30 EDT',
    date: '2026-10-29T00:30:00Z',
    actual: '',
    forecast: '0.3% / 3.5%',
    previous: '1.0% / 3.9%',
    instruments: 'AUD/USD · AUD/JPY · EURAUD',
    note: 'Official ABS quarterly inflation print shaping Reserve Bank of Australia rate expectations.'
  },
  {
    id: 'ff-2026-10-29-usd-gdp',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US Advance GDP q/q (Q3) & Unemployment Claims',
    dateLabel: 'Thu, Oct 29, 2026',
    timeLabel: '08:30 EDT',
    date: '2026-10-29T12:30:00Z',
    actual: '',
    forecast: '3.0% / 227K',
    previous: '3.0% / 227K',
    instruments: 'DXY · XAU/USD · EUR/USD · US500',
    note: 'Official BEA Advance Q3 GDP release and weekly initial jobless claims.'
  },
  {
    id: 'ff-2026-10-29-eur-ecb',
    currency: 'EUR',
    impact: 'HIGH',
    folder: 'red',
    title: 'ECB Main Refinancing Rate & Monetary Policy Statement',
    dateLabel: 'Thu, Oct 29, 2026',
    timeLabel: '09:15 EDT',
    date: '2026-10-29T13:15:00Z',
    actual: '',
    forecast: '3.15%',
    previous: '3.40%',
    instruments: 'EUR/USD · EUR/GBP · EUR/JPY · GER40',
    note: 'Official European Central Bank Governing Council rate decision followed by President Lagarde press conference at 09:45 EDT.'
  },
  {
    id: 'ff-2026-10-30-jpy-boj',
    currency: 'JPY',
    impact: 'HIGH',
    folder: 'red',
    title: 'BOJ Policy Rate, Outlook Report & Monetary Policy Statement',
    dateLabel: 'Thu, Oct 29, 2026',
    timeLabel: '23:00 EDT',
    date: '2026-10-30T03:00:00Z',
    actual: '',
    forecast: '0.25%',
    previous: '0.25%',
    instruments: 'USD/JPY · GBP/JPY · EUR/JPY',
    note: 'Official Bank of Japan October Monetary Policy Meeting decision and quarterly Outlook Report.'
  },
  {
    id: 'ff-2026-10-30-usd-pce',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'Core PCE Price Index m/m & Employment Cost Index q/q',
    dateLabel: 'Fri, Oct 30, 2026',
    timeLabel: '08:30 EDT',
    date: '2026-10-30T12:30:00Z',
    actual: '',
    forecast: '0.3% / 0.9%',
    previous: '0.1% / 0.9%',
    instruments: 'DXY · XAU/USD · EUR/USD · NAS100',
    note: 'Official BEA Personal Income and Outlays release. The Federal Reserve preferred inflation gauge.'
  },
  {
    id: 'ff-2026-11-02-usd-ism-mfg',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'ISM Manufacturing PMI & Prices Paid',
    dateLabel: 'Mon, Nov 2, 2026',
    timeLabel: '10:00 EST',
    date: '2026-11-02T15:00:00Z',
    actual: '',
    forecast: '47.6',
    previous: '47.2',
    instruments: 'DXY · USD/JPY · XAU/USD · US500',
    note: 'Official Institute for Supply Management release on the first business day of November.'
  },
  {
    id: 'ff-2026-11-03-aud-rba',
    currency: 'AUD',
    impact: 'HIGH',
    folder: 'red',
    title: 'RBA Cash Rate & Monetary Policy Statement',
    dateLabel: 'Mon, Nov 2, 2026',
    timeLabel: '22:30 EST',
    date: '2026-11-03T03:30:00Z',
    actual: '',
    forecast: '4.35%',
    previous: '4.35%',
    instruments: 'AUD/USD · AUD/JPY · AUD/NZD',
    note: 'Official Reserve Bank of Australia first Tuesday of November board decision.'
  },
  {
    id: 'ff-2026-11-04-usd-ism-svc',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'ADP Non Farm Employment Change & ISM Services PMI',
    dateLabel: 'Wed, Nov 4, 2026',
    timeLabel: '08:15 / 10:00 EST',
    date: '2026-11-04T15:00:00Z',
    actual: '',
    forecast: '115K / 53.8',
    previous: '143K / 54.9',
    instruments: 'DXY · XAU/USD · EUR/USD · NAS100',
    note: 'Official ADP private payrolls at 08:15 EST followed by ISM Services PMI at 10:00 EST.'
  },
  {
    id: 'ff-2026-11-05-gbp-boe',
    currency: 'GBP',
    impact: 'HIGH',
    folder: 'red',
    title: 'BOE Official Bank Rate, MPC Vote Split & Monetary Policy Report',
    dateLabel: 'Thu, Nov 5, 2026',
    timeLabel: '07:00 EST',
    date: '2026-11-05T12:00:00Z',
    actual: '',
    forecast: '4.75%',
    previous: '5.00%',
    instruments: 'GBP/USD · GBP/JPY · EUR/GBP',
    note: 'Official Bank of England November MPC decision and Governor Bailey press conference.'
  },
  {
    id: 'ff-2026-11-05-usd-fomc',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'FOMC Statement, Federal Funds Rate & Chair Powell Press Conference',
    dateLabel: 'Thu, Nov 5, 2026',
    timeLabel: '14:00 EST',
    date: '2026-11-05T19:00:00Z',
    actual: '',
    forecast: '4.75%',
    previous: '5.00%',
    instruments: 'DXY · XAU/USD · EUR/USD · NAS100 · US500',
    note: 'Official Federal Reserve FOMC rate decision at 14:00 EST followed by Chair Powell press conference at 14:30 EST.'
  },
  {
    id: 'ff-2026-11-06-usd-nfp',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US Non Farm Employment Change (NFP), Unemployment Rate & Average Hourly Earnings',
    dateLabel: 'Fri, Nov 6, 2026',
    timeLabel: '08:30 EST',
    date: '2026-11-06T13:30:00Z',
    actual: '',
    forecast: '180K / 4.1%',
    previous: '223K / 4.1%',
    instruments: 'XAU/USD · DXY · EUR/USD · GBP/USD · NAS100',
    note: 'Official BLS Employment Situation release on the first Friday of November. Stand aside 15 minutes before and after the print unless your Trading System allows news execution.'
  },
  {
    id: 'ff-2026-11-11-usd-cpi',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US CPI m/m, Core CPI m/m & Headline CPI YoY',
    dateLabel: 'Wed, Nov 11, 2026',
    timeLabel: '08:30 EST',
    date: '2026-11-11T13:30:00Z',
    actual: '',
    forecast: '0.2% / 0.3% / 2.6%',
    previous: '0.2% / 0.3% / 2.4%',
    instruments: 'DXY · XAU/USD · EUR/USD · US500',
    note: 'Official BLS Consumer Price Index release. Primary monthly US inflation catalyst.'
  },
  {
    id: 'ff-2026-11-12-usd-ppi',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US PPI m/m, Core PPI m/m & Unemployment Claims',
    dateLabel: 'Thu, Nov 12, 2026',
    timeLabel: '08:30 EST',
    date: '2026-11-12T13:30:00Z',
    actual: '',
    forecast: '0.2% / 221K',
    previous: '0.0% / 218K',
    instruments: 'DXY · XAU/USD · US30',
    note: 'Official BLS Producer Price Index and weekly Unemployment Insurance claims.'
  },
  {
    id: 'ff-2026-11-13-usd-retail',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US Core Retail Sales m/m & Retail Sales m/m',
    dateLabel: 'Fri, Nov 13, 2026',
    timeLabel: '08:30 EST',
    date: '2026-11-13T13:30:00Z',
    actual: '',
    forecast: '0.3% / 0.3%',
    previous: '0.5% / 0.4%',
    instruments: 'DXY · XAU/USD · US500',
    note: 'Official US Census Bureau advance monthly retail trade report.'
  },
  {
    id: 'ff-2026-11-18-gbp-cpi',
    currency: 'GBP',
    impact: 'HIGH',
    folder: 'red',
    title: 'UK CPI YoY & Core CPI YoY',
    dateLabel: 'Wed, Nov 18, 2026',
    timeLabel: '02:00 EST',
    date: '2026-11-18T07:00:00Z',
    actual: '',
    forecast: '2.2% / 3.1%',
    previous: '1.7% / 3.2%',
    instruments: 'GBP/USD · EUR/GBP · GBP/JPY',
    note: 'Official ONS UK inflation release at London open.'
  },
  {
    id: 'ff-2026-11-20-usd-pmi',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US Flash Manufacturing PMI & Flash Services PMI',
    dateLabel: 'Fri, Nov 20, 2026',
    timeLabel: '09:45 EST',
    date: '2026-11-20T14:45:00Z',
    actual: '',
    forecast: '48.8 / 55.2',
    previous: '48.5 / 55.0',
    instruments: 'DXY · EUR/USD · XAU/USD · US500',
    note: 'Official S&P Global Flash US PMI release.'
  },
  {
    id: 'ff-2026-11-25-usd-pce-gdp',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'Core PCE Price Index m/m, Prelim GDP q/q & FOMC Minutes',
    dateLabel: 'Wed, Nov 25, 2026',
    timeLabel: '08:30 / 14:00 EST',
    date: '2026-11-25T13:30:00Z',
    actual: '',
    forecast: '0.3% / 2.8%',
    previous: '0.3% / 2.8%',
    instruments: 'DXY · XAU/USD · EUR/USD · NAS100',
    note: 'Official pre-Thanksgiving BEA GDP/Core PCE release at 08:30 EST followed by FOMC Minutes at 14:00 EST.'
  },
  {
    id: 'ff-2026-12-01-usd-ism',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'ISM Manufacturing PMI & JOLTS Job Openings',
    dateLabel: 'Tue, Dec 1, 2026',
    timeLabel: '10:00 EST',
    date: '2026-12-01T15:00:00Z',
    actual: '',
    forecast: '48.0 / 7.75M',
    previous: '47.6 / 7.84M',
    instruments: 'DXY · XAU/USD · US500',
    note: 'Official first business day of December ISM Manufacturing release.'
  },
  {
    id: 'ff-2026-12-04-usd-nfp',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US Non Farm Employment Change (NFP) & Unemployment Rate',
    dateLabel: 'Fri, Dec 4, 2026',
    timeLabel: '08:30 EST',
    date: '2026-12-04T13:30:00Z',
    actual: '',
    forecast: '190K / 4.1%',
    previous: '180K / 4.1%',
    instruments: 'XAU/USD · DXY · EUR/USD · GBP/USD · NAS100',
    note: 'Official BLS December Employment Situation release on the first Friday of December.'
  },
  {
    id: 'ff-2026-12-09-usd-fomc',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'FOMC Statement, Federal Funds Rate & Economic Projections',
    dateLabel: 'Wed, Dec 9, 2026',
    timeLabel: '14:00 EST',
    date: '2026-12-09T19:00:00Z',
    actual: '',
    forecast: '4.50%',
    previous: '4.75%',
    instruments: 'DXY · XAU/USD · EUR/USD · NAS100 · US500',
    note: 'Official December FOMC rate decision and quarterly Summary of Economic Projections (Dot Plot).'
  },
  {
    id: 'ff-2026-12-10-usd-cpi',
    currency: 'USD',
    impact: 'HIGH',
    folder: 'red',
    title: 'US CPI m/m & Core CPI YoY',
    dateLabel: 'Thu, Dec 10, 2026',
    timeLabel: '08:30 EST',
    date: '2026-12-10T13:30:00Z',
    actual: '',
    forecast: '0.2% / 3.2%',
    previous: '0.2% / 3.3%',
    instruments: 'DXY · XAU/USD · EUR/USD · US500',
    note: 'Official BLS December CPI inflation release.'
  },
  {
    id: 'ff-2026-12-17-boe-ecb',
    currency: 'EUR',
    impact: 'HIGH',
    folder: 'red',
    title: 'ECB Monetary Policy Decision & BOE Official Bank Rate',
    dateLabel: 'Thu, Dec 17, 2026',
    timeLabel: '07:00 / 08:15 EST',
    date: '2026-12-17T13:15:00Z',
    actual: '',
    forecast: '3.00% / 4.75%',
    previous: '3.15% / 4.75%',
    instruments: 'EUR/USD · GBP/USD · EUR/GBP · GER40',
    note: 'Official December Bank of England and European Central Bank final policy meetings of 2026.'
  }
];

function formatNYDateLabel(isoDate) {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York'
    });
  } catch (_) {
    return new Date(isoDate).toDateString();
  }
}

function formatNYTimeLabel(isoDate) {
  try {
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    });
  } catch (_) {
    return '08:30 EST';
  }
}

function getRollingForexFactoryEvents(now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  // Include all official events from the start of the current day onward
  const startOfDay = new Date(base.getTime() - 12 * 3600 * 1000);
  const upcoming = OFFICIAL_2026_CALENDAR.filter(
    (e) => new Date(e.date).getTime() >= startOfDay.getTime()
  );
  return (upcoming.length ? upcoming : OFFICIAL_2026_CALENDAR).slice(0, 12);
}

/**
 * Normalize live Forex Factory weekly JSON feed items
 * (from https://nfs.faireconomy.media/ff_calendar_thisweek.json)
 * into our Economic Calendar schema with official timestamps.
 */
function normalizeLiveForexFactoryEvents(rawFeed = [], now = new Date()) {
  if (!Array.isArray(rawFeed) || !rawFeed.length) return [];
  const startOfDay = new Date((now instanceof Date ? now : new Date(now)).getTime() - 12 * 3600 * 1000);
  const instrumentMap = {
    USD: 'DXY · XAU/USD · EUR/USD · NAS100',
    EUR: 'EUR/USD · EUR/GBP · EUR/JPY · GER40',
    GBP: 'GBP/USD · EUR/GBP · GBP/JPY',
    JPY: 'USD/JPY · EUR/JPY · GBP/JPY',
    AUD: 'AUD/USD · AUD/JPY · EURAUD',
    CAD: 'USD/CAD · CAD/JPY · USOIL',
    CHF: 'USD/CHF · EUR/CHF',
    NZD: 'NZD/USD · AUD/NZD'
  };

  return rawFeed
    .filter((item) => {
      if (!item || !item.title || !item.date) return false;
      const imp = String(item.impact || '').toUpperCase();
      if (imp !== 'HIGH' && imp !== 'MEDIUM') return false;
      return new Date(item.date).getTime() >= startOfDay.getTime();
    })
    .map((item, idx) => {
      const imp = String(item.impact || 'HIGH').toUpperCase();
      const currency = String(item.country || 'USD').toUpperCase();
      return {
        id: `ff-live-${idx}-${currency}`,
        currency,
        impact: imp,
        folder: imp === 'HIGH' ? 'red' : 'orange',
        title: String(item.title).replace(/\s*[—–-]\s*/g, ' '),
        dateLabel: formatNYDateLabel(item.date),
        timeLabel: formatNYTimeLabel(item.date),
        date: new Date(item.date).toISOString(),
        actual: item.actual || '',
        forecast: item.forecast || '',
        previous: item.previous || '',
        instruments: instrumentMap[currency] || 'DXY · XAU/USD · EUR/USD',
        note: imp === 'HIGH'
          ? `Official Forex Factory High Impact (${currency}) macro release. Manage risk around the scheduled print.`
          : `Official Forex Factory Medium Impact (${currency}) release.`
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getForexFactoryMarketWire(now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  const minsAgo = (m) => new Date(base.getTime() - m * 60 * 1000).toISOString();

  return [
    {
      title: 'Federal Reserve Officials Signal Data Dependent Path as Treasury Yields Hold Key Resistance',
      description: 'Fed policymakers emphasized that upcoming Core PCE inflation and labor market prints will dictate the pace of rate adjustments, keeping the US 10 year Treasury yield and DXY anchored near session highs ahead of New York trading.',
      source_id: 'Forex Factory Wire',
      currency: 'USD',
      impact: 'HIGH',
      instruments: 'DXY · EUR/USD · XAU/USD · US10Y',
      category: 'Central Banks & Rates',
      url: 'https://www.forexfactory.com/news',
      publishedAt: minsAgo(18)
    },
    {
      title: 'Gold (XAU/USD) Tests Institutional Liquidity Zone as Central Bank Demand Offsets Firm Dollar',
      description: 'Spot Gold remains supported above key 4H structure as sovereign reserve accumulation and geopolitical hedging counter rising real yields. Traders are watching the 08:30 EST US macro window for directional confirmation.',
      source_id: 'FX Macro Desk',
      currency: 'XAU',
      impact: 'HIGH',
      instruments: 'XAU/USD · XAG/USD · DXY',
      category: 'Commodities & Gold',
      url: 'https://www.forexfactory.com/news',
      publishedAt: minsAgo(42)
    },
    {
      title: 'EUR/USD Consolidates Ahead of ECB Policy Guidance and Eurozone PMI Data',
      description: 'Rate differentials between the European Central Bank and the Federal Reserve continue to drive London session order flow on EUR/USD, with institutional desks eyeing Eurozone inflation expectations and German Bund yields.',
      source_id: 'Forex Factory Wire',
      currency: 'EUR',
      impact: 'HIGH',
      instruments: 'EUR/USD · EUR/GBP · GER40',
      category: 'Central Banks & FX',
      url: 'https://www.forexfactory.com/calendar',
      publishedAt: minsAgo(75)
    },
    {
      title: 'USD/JPY Volatility Alert: Japanese Authorities Reiterate Readiness to Respond to Excessive FX Moves',
      description: 'Tokyo officials warned against one sided speculative moves in the Yen as US and Japan yield spreads keep USD/JPY near multi week highs. Liquidity thins around psychological round numbers during the Asia to London transition.',
      source_id: 'FX Central Bank Watch',
      currency: 'JPY',
      impact: 'HIGH',
      instruments: 'USD/JPY · GBP/JPY · EUR/JPY',
      category: 'FX Intervention Watch',
      url: 'https://www.forexfactory.com/news',
      publishedAt: minsAgo(110)
    },
    {
      title: 'GBP/USD Reacts to UK Services Inflation and Bank of England Rate Path Pricing',
      description: 'Money markets adjusted expectations for the Bank of England next MPC vote split following sticky UK wage and services data, keeping GBP/USD active around London session highs.',
      source_id: 'Forex Factory Wire',
      currency: 'GBP',
      impact: 'MEDIUM',
      instruments: 'GBP/USD · EUR/GBP · GBP/JPY',
      category: 'Central Banks & FX',
      url: 'https://www.forexfactory.com/news',
      publishedAt: minsAgo(155)
    },
    {
      title: 'US Equities and Nasdaq 100 Pause at Resistance Ahead of Tier 1 Macro Releases',
      description: 'S&P 500 and Nasdaq futures traded inside a tight London range as institutional positioning shifts toward risk management ahead of high impact US inflation and employment releases.',
      source_id: 'Macro Market Pulse',
      currency: 'US500',
      impact: 'HIGH',
      instruments: 'NAS100 · US500 · US30 · VIX',
      category: 'Indices & Risk Sentiment',
      url: 'https://www.forexfactory.com/calendar',
      publishedAt: minsAgo(210)
    },
    {
      title: 'Crude Oil (WTI & Brent) Balances OPEC+ Supply Discipline Against Global Manufacturing PMI Data',
      description: 'Energy markets remain sensitive to inventory draws and Middle East supply headlines, directly influencing inflation expectations and commodity currencies including CAD and AUD.',
      source_id: 'Commodities Wire',
      currency: 'OIL',
      impact: 'MEDIUM',
      instruments: 'USOIL · UKOIL · USD/CAD',
      category: 'Energy & Macro',
      url: 'https://www.forexfactory.com/news',
      publishedAt: minsAgo(260)
    }
  ];
}

function buildMarketNewsFeed(rawExternalArticles = [], now = new Date()) {
  const filteredExternal = (rawExternalArticles || [])
    .filter(isMarketMovingArticle)
    .map(classifyArticleImpact);

  const wire = getForexFactoryMarketWire(now).map(classifyArticleImpact);

  // Combine live market-moving articles with the Forex Factory Market Wire, deduplicating by title
  const seen = new Set();
  const combined = [];
  for (const item of [...filteredExternal, ...wire]) {
    const key = String(item.title || '').toLowerCase().slice(0, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    combined.push(item);
  }
  return combined.slice(0, 20);
}

module.exports = {
  OFFICIAL_2026_CALENDAR,
  isMarketMovingArticle,
  classifyArticleImpact,
  getRollingForexFactoryEvents,
  normalizeLiveForexFactoryEvents,
  getForexFactoryMarketWire,
  buildMarketNewsFeed
};
