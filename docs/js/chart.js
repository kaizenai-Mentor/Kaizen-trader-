// ── KAIZEN CHART ENGINE ──

const KAIZEN_CHART = {
  chart: null,
  candleSeries: null,
  volumeSeries: null,
  currentAsset: null,
  currentSource: null,
  currentTimeframe: '60',
  drawings: [],
  drawingMode: null,
  clickPoints: [],
  ws: null,

  init() {
    this.buildChart();
    this.bindControls();
    this.loadAsset('BTCUSDT', 'bybit', 'BTC/USDT');
  },

  buildChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;

    this.chart = LightweightCharts.createChart(container, {
      width: container.offsetWidth,
      height: container.offsetHeight,
      layout: {
        background: { color: '#080808' },
        textColor: '#A8A09A',
        fontFamily: "'DM Mono', monospace"
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(201,168,76,0.4)',
          labelBackgroundColor: '#C9A84C'
        },
        horzLine: {
          color: 'rgba(201,168,76,0.4)',
          labelBackgroundColor: '#C9A84C'
        }
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: '#A8A09A'
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: '#A8A09A',
        timeVisible: true,
        secondsVisible: false
      },
      watermark: {
        visible: true,
        text: '改 KAIZEN',
        color: 'rgba(201,168,76,0.04)',
        fontSize: 48,
        fontFamily: 'monospace'
      }
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#34D399',
      downColor: '#F87171',
      borderUpColor: '#34D399',
      borderDownColor: '#F87171',
      wickUpColor: '#34D399',
      wickDownColor: '#F87171'
    });

    this.volumeSeries = this.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#26a69a',
      scaleMargins: { top: 0.85, bottom: 0 }
    });

    // Resize observer
    new ResizeObserver(() => {
      if (this.chart && container) {
        this.chart.applyOptions({
          width: container.offsetWidth,
          height: container.offsetHeight
        });
      }
    }).observe(container);
  },

  async loadAsset(symbol, source, label, timeframe) {
    if (timeframe) this.currentTimeframe = timeframe;
    this.currentAsset = symbol;
    this.currentSource = source;

    this.setStatus('loading', `Loading ${label}...`);

    try {
      const res = await fetch(
        `/chart/data?symbol=${encodeURIComponent(symbol)}&source=${source}&timeframe=${this.currentTimeframe}&limit=300`
      );
      const data = await res.json();

      if (!data.success || !data.candles.length) {
        this.setStatus('error', 'No data available');
        return;
      }

      this.candleSeries.setData(data.candles);

      const volumeData = data.candles.map(c => ({
        time: c.time,
        value: c.volume || 0,
        color: c.close >= c.open
          ? 'rgba(52,211,153,0.3)'
          : 'rgba(248,113,113,0.3)'
      }));
      this.volumeSeries.setData(volumeData);

      this.chart.timeScale().fitContent();

      // Update header
      const last = data.candles[data.candles.length - 1];
      this.updatePriceHeader(label, last);

      this.setStatus('live', label);

      // Load saved drawings
      await this.loadDrawings(symbol, this.currentTimeframe);

      // Start live updates for crypto
      if (source === 'bybit') {
        this.startWebSocket(symbol);
      }

    } catch (err) {
      console.error('Load asset error:', err);
      this.setStatus('error', 'Failed to load data');
    }
  },

  updatePriceHeader(label, candle) {
    const priceEl = document.getElementById('chart-price');
    const changeEl = document.getElementById('chart-change');
    if (!priceEl || !candle) return;

    const price = candle.close.toFixed(candle.close > 100 ? 2 : 5);
    priceEl.textContent = price;

    const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
    if (changeEl) {
      changeEl.textContent = `${change > 0 ? '+' : ''}${change}%`;
      changeEl.style.color = change >= 0 ? '#34D399' : '#F87171';
    }
  },

  startWebSocket(symbol) {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          op: 'subscribe',
          args: [`kline.${this.currentTimeframe}.${symbol}`]
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.topic && msg.topic.startsWith('kline') && msg.data) {
            const k = msg.data[0];
            if (!k) return;

            const candle = {
              time: Math.floor(k.start / 1000),
              open: parseFloat(k.open),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              close: parseFloat(k.close),
              volume: parseFloat(k.volume)
            };

            this.candleSeries.update(candle);
            this.updatePriceHeader(symbol, candle);
          }
        } catch (e) {}
      };

      this.ws.onerror = () => {};
      this.ws.onclose = () => {};
    } catch (e) {}
  },

  bindControls() {
    // Timeframe buttons
    document.querySelectorAll('[data-tf]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tf]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTimeframe = btn.getAttribute('data-tf');
        if (this.currentAsset) {
          this.loadAsset(
            this.currentAsset,
            this.currentSource,
            document.getElementById('chart-label')?.textContent || this.currentAsset,
            this.currentTimeframe
          );
        }
      });
    });

    // Drawing tools
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        if (this.drawingMode === tool) {
          this.setDrawingMode(null);
        } else {
          this.setDrawingMode(tool);
        }
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        if (this.drawingMode) btn.classList.add('active');
      });
    });

    // Clear drawings
    const clearBtn = document.getElementById('clear-drawings');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear all drawings on this chart?')) {
          this.clearDrawings();
        }
      });
    }

    // Fit button
    const fitBtn = document.getElementById('fit-chart');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        this.chart?.timeScale().fitContent();
      });
    }

    // Chart click for drawings
    if (this.chart) {
      this.chart.subscribeClick((param) => {
        if (!this.drawingMode || !param.time) return;
        const price = this.candleSeries.coordinateToPrice(param.point.y);
        this.handleChartClick(param.time, price);
      });
    }
  },

  setDrawingMode(mode) {
    this.drawingMode = mode;
    this.clickPoints = [];
    const container = document.getElementById('chart-container');
    if (container) {
      container.style.cursor = mode ? 'crosshair' : 'default';
    }
    const modeEl = document.getElementById('drawing-mode');
    if (modeEl) {
      modeEl.textContent = mode
        ? `Drawing: ${mode.replace('-', ' ').toUpperCase()}`
        : '';
    }
  },

  handleChartClick(time, price) {
    if (!price) return;
    this.clickPoints.push({ time, price });

    if (this.drawingMode === 'hline') {
      this.addHorizontalLine(price);
      this.clickPoints = [];
    } else if (this.drawingMode === 'tline' && this.clickPoints.length === 2) {
      this.addTrendLine(this.clickPoints[0], this.clickPoints[1]);
      this.clickPoints = [];
    } else if (this.drawingMode === 'fib' && this.clickPoints.length === 2) {
      this.addFibonacci(this.clickPoints[0].price, this.clickPoints[1].price, this.clickPoints[0].time);
      this.clickPoints = [];
    }
  },

  addHorizontalLine(price) {
    const line = this.candleSeries.createPriceLine({
      price: price,
      color: '#C9A84C',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Level'
    });

    this.drawings.push({
      type: 'hline',
      price,
      id: Date.now(),
      lineRef: line
    });

    this.saveDrawings();
  },

  addTrendLine(p1, p2) {
    const series = this.chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false
    });

    series.setData([
      { time: p1.time, value: p1.price },
      { time: p2.time, value: p2.price }
    ]);

    this.drawings.push({
      type: 'tline',
      p1, p2,
      id: Date.now(),
      seriesRef: series
    });

    this.saveDrawings();
  },

  addFibonacci(price1, price2, startTime) {
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const colors = ['#C9A84C', '#A8A09A', '#3B82F6', '#F87171', '#3B82F6', '#A8A09A', '#C9A84C'];
    const diff = price2 - price1;

    levels.forEach((level, i) => {
      const price = price1 + diff * level;
      const line = this.candleSeries.createPriceLine({
        price,
        color: colors[i],
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        axisLabelVisible: true,
        title: `${(level * 100).toFixed(1)}%`
      });

      this.drawings.push({
        type: 'fib',
        price, level,
        id: Date.now() + i,
        lineRef: line
      });
    });

    this.saveDrawings();
  },

  clearDrawings() {
    this.drawings.forEach(d => {
      try {
        if (d.lineRef) this.candleSeries.removePriceLine(d.lineRef);
        if (d.seriesRef) this.chart.removeSeries(d.seriesRef);
      } catch (e) {}
    });
    this.drawings = [];
    this.saveDrawings();
  },

  async saveDrawings(asset, timeframe) {
    const a = asset || this.currentAsset;
    const tf = timeframe || this.currentTimeframe;
    if (!a) return;

    const saveable = this.drawings.map(d => ({
      type: d.type,
      price: d.price,
      p1: d.p1,
      p2: d.p2,
      level: d.level,
      id: d.id
    }));

    try {
      await fetch('/chart/drawings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: a, timeframe: tf, drawings: saveable })
      });
    } catch (e) {}
  },

  async loadDrawings(asset, timeframe) {
    try {
      const res = await fetch(
        `/chart/drawings/load?asset=${encodeURIComponent(asset)}&timeframe=${timeframe}`
      );
      const data = await res.json();

      if (data.drawings && data.drawings.length) {
        data.drawings.forEach(d => {
          if (d.type === 'hline' && d.price) {
            const line = this.candleSeries.createPriceLine({
              price: d.price,
              color: '#C9A84C',
              lineWidth: 1,
              lineStyle: LightweightCharts.LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'Level'
            });
            this.drawings.push({ ...d, lineRef: line });
          } else if (d.type === 'tline' && d.p1 && d.p2) {
            const series = this.chart.addLineSeries({
              color: '#3B82F6',
              lineWidth: 1,
              lineStyle: LightweightCharts.LineStyle.Solid,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false
            });
            series.setData([
              { time: d.p1.time, value: d.p1.price },
              { time: d.p2.time, value: d.p2.price }
            ]);
            this.drawings.push({ ...d, seriesRef: series });
          } else if (d.type === 'fib' && d.price) {
            const line = this.candleSeries.createPriceLine({
              price: d.price,
              color: '#C9A84C',
              lineWidth: 1,
              lineStyle: LightweightCharts.LineStyle.Dotted,
              axisLabelVisible: true,
              title: d.level ? `${(d.level * 100).toFixed(1)}%` : 'Fib'
            });
            this.drawings.push({ ...d, lineRef: line });
          }
        });
      }
    } catch (e) {}
  },

  setStatus(type, text) {
    const el = document.getElementById('chart-status');
    if (!el) return;
    const colors = {
      live: '#34D399',
      loading: '#C9A84C',
      error: '#F87171'
    };
    el.textContent = text;
    el.style.color = colors[type] || '#A8A09A';
  }
};

// Asset selector
function selectAsset(symbol, source, label) {
  document.getElementById('chart-label').textContent = label;
  document.getElementById('asset-dropdown').classList.remove('open');
  KAIZEN_CHART.loadAsset(symbol, source, label);
}

function toggleAssetDropdown() {
  document.getElementById('asset-dropdown').classList.toggle('open');
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('chart-container')) {
    KAIZEN_CHART.init();
  }
});
