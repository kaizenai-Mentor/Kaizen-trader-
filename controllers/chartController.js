const axios = require('axios');
const Drawing = require('../models/Drawing');

const TWELVE_KEY = process.env.TWELVE_DATA_API_KEY;
const BYBIT_BASE = 'https://api.bybit.com';
const TWELVE_BASE = 'https://api.twelvedata.com';

// Asset configuration
const ASSETS = {
  crypto: [
    { symbol: 'BTCUSDT', label: 'BTC/USDT', source: 'bybit' },
    { symbol: 'ETHUSDT', label: 'ETH/USDT', source: 'bybit' },
    { symbol: 'BNBUSDT', label: 'BNB/USDT', source: 'bybit' },
    { symbol: 'SOLUSDT', label: 'SOL/USDT', source: 'bybit' },
    { symbol: 'XRPUSDT', label: 'XRP/USDT', source: 'bybit' },
    { symbol: 'ADAUSDT', label: 'ADA/USDT', source: 'bybit' },
    { symbol: 'DOGEUSDT', label: 'DOGE/USDT', source: 'bybit' },
    { symbol: 'AVAXUSDT', label: 'AVAX/USDT', source: 'bybit' }
  ],
  forex: [
    { symbol: 'EUR/USD', label: 'EUR/USD', source: 'twelve' },
    { symbol: 'GBP/USD', label: 'GBP/USD', source: 'twelve' },
    { symbol: 'USD/JPY', label: 'USD/JPY', source: 'twelve' },
    { symbol: 'AUD/USD', label: 'AUD/USD', source: 'twelve' },
    { symbol: 'USD/CAD', label: 'USD/CAD', source: 'twelve' },
    { symbol: 'USD/CHF', label: 'USD/CHF', source: 'twelve' },
    { symbol: 'NZD/USD', label: 'NZD/USD', source: 'twelve' },
    { symbol: 'EUR/GBP', label: 'EUR/GBP', source: 'twelve' }
  ],
  stocks: [
    { symbol: 'AAPL', label: 'Apple', source: 'twelve' },
    { symbol: 'TSLA', label: 'Tesla', source: 'twelve' },
    { symbol: 'NVDA', label: 'NVIDIA', source: 'twelve' },
    { symbol: 'AMZN', label: 'Amazon', source: 'twelve' },
    { symbol: 'MSFT', label: 'Microsoft', source: 'twelve' },
    { symbol: 'GOOGL', label: 'Google', source: 'twelve' },
    { symbol: 'META', label: 'Meta', source: 'twelve' },
    { symbol: 'NFLX', label: 'Netflix', source: 'twelve' }
  ],
  indices: [
    { symbol: 'SPX', label: 'S&P 500', source: 'twelve' },
    { symbol: 'IXIC', label: 'NASDAQ', source: 'twelve' },
    { symbol: 'DJI', label: 'Dow Jones', source: 'twelve' },
    { symbol: 'FTSE', label: 'FTSE 100', source: 'twelve' },
    { symbol: 'DAX', label: 'DAX', source: 'twelve' },
    { symbol: 'NI225', label: 'Nikkei 225', source: 'twelve' }
  ],
  synthetic: [
    { symbol: 'V75', label: 'Volatility 75', source: 'synthetic' },
    { symbol: 'V100', label: 'Volatility 100', source: 'synthetic' },
    { symbol: 'BOOM1000', label: 'Boom 1000', source: 'synthetic' },
    { symbol: 'CRASH1000', label: 'Crash 1000', source: 'synthetic' },
    { symbol: 'STEP', label: 'Step Index', source: 'synthetic' }
  ],
  commodities: [
    { symbol: 'XAU/USD', label: 'Gold', source: 'twelve' },
    { symbol: 'XAG/USD', label: 'Silver', source: 'twelve' },
    { symbol: 'WTI/USD', label: 'Crude Oil', source: 'twelve' },
    { symbol: 'NATGAS', label: 'Natural Gas', source: 'twelve' },
    { symbol: 'COPPER', label: 'Copper', source: 'twelve' }
  ]
};

// Timeframe mapping
const TF_BYBIT = {
  '1': '1', '5': '5', '15': '15', '30': '30',
  '60': '60', '240': '240', 'D': 'D', 'W': 'W'
};

const TF_TWELVE = {
  '1': '1min', '5': '5min', '15': '15min', '30': '30min',
  '60': '1h', '240': '4h', 'D': '1day', 'W': '1week'
};

// GET /chart
const getChart = (req, res) => {
  res.render('chart', {
    user: req.session.user,
    assets: ASSETS
  });
};

// GET /chart/data?symbol=BTCUSDT&source=bybit&timeframe=60&limit=200
const getChartData = async (req, res) => {
  const { symbol, source, timeframe = '60', limit = 200 } = req.query;

  try {
    let candles = [];

    if (source === 'bybit') {
      const interval = TF_BYBIT[timeframe] || '60';
      const response = await axios.get(`${BYBIT_BASE}/v5/market/kline`, {
        params: {
          category: 'linear',
          symbol: symbol,
          interval: interval,
          limit: limit
        },
        timeout: 8000
      });

      const list = response.data?.result?.list || [];
      candles = list.map(k => ({
        time: Math.floor(parseInt(k[0]) / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      })).reverse();

    } else if (source === 'twelve') {
      const interval = TF_TWELVE[timeframe] || '1h';
      const response = await axios.get(`${TWELVE_BASE}/time_series`, {
        params: {
          symbol: symbol,
          interval: interval,
          outputsize: limit,
          apikey: TWELVE_KEY,
          format: 'JSON'
        },
        timeout: 10000
      });

      const values = response.data?.values || [];
      candles = values.map(k => ({
        time: Math.floor(new Date(k.datetime).getTime() / 1000),
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume || 0)
      })).reverse();

    } else if (source === 'synthetic') {
      // Generate realistic synthetic data for demo
      candles = generateSynthetic(symbol, parseInt(limit));
    }

    if (!candles.length) {
      return res.json({ success: false, error: 'No data returned', candles: [] });
    }

    res.json({ success: true, candles });

  } catch (error) {
    console.error('Chart data error:', error.message);
    res.json({
      success: false,
      error: error.message,
      candles: generateSynthetic('FALLBACK', parseInt(limit))
    });
  }
};

// Generate synthetic candle data
function generateSynthetic(symbol, count = 200) {
  const candles = [];
  let price = symbol.includes('V75') ? 500 :
               symbol.includes('V100') ? 1000 :
               symbol.includes('BOOM') ? 800 :
               symbol.includes('CRASH') ? 600 : 700;

  const now = Math.floor(Date.now() / 1000);
  const interval = 3600;

  for (let i = count; i >= 0; i--) {
    const volatility = symbol.includes('V100') ? 0.025 :
                       symbol.includes('V75') ? 0.018 : 0.012;
    const change = (Math.random() - 0.48) * price * volatility;
    const open = price;
    const close = Math.max(price + change, 1);
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    price = close;

    candles.push({
      time: now - (i * interval),
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      volume: Math.floor(Math.random() * 10000)
    });
  }
  return candles;
}

// POST /chart/drawings/save
const saveDrawings = async (req, res) => {
  try {
    const { asset, timeframe, drawings } = req.body;
    const userId = req.session.user.id;

    await Drawing.findOneAndUpdate(
      { userId, asset, timeframe },
      { userId, asset, timeframe, drawings, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save drawings error:', error.message);
    res.json({ success: false, error: error.message });
  }
};

// GET /chart/drawings/load?asset=BTCUSDT&timeframe=60
const loadDrawings = async (req, res) => {
  try {
    const { asset, timeframe } = req.query;
    const userId = req.session.user.id;

    const record = await Drawing.findOne({ userId, asset, timeframe });
    res.json({ success: true, drawings: record?.drawings || [] });
  } catch (error) {
    console.error('Load drawings error:', error.message);
    res.json({ success: false, drawings: [] });
  }
};

module.exports = {
  getChart,
  getChartData,
  saveDrawings,
  loadDrawings
};
