/**
 * tradfiScoring.js — Theme scoring + extension lists + regime read + ETF pulse.
 *
 * Ported from SMB (Stable Market Board) stable/scoring.py.
 * All functions operate on the `assets` array from tradData (computed by
 * computeTradMetrics in traditionalMarkets.js). No database access needed —
 * pure post-processing on already-computed metrics.
 *
 * Functions:
 *   - computeThemeScores(assets) → theme scores with status labels
 *   - getExtensionLists(assets) → too hot / clean momentum / fading
 *   - getRegimeRead(assets) → benchmark snapshot + breadth counts
 *   - getEtfPulse(assets) → style/risk/sector rotation
 *   - getLeadershipShifts(assets) → top-30 RS QQQ turnover (requires prior data)
 */

// ── Constants ────────────────────────────────────────────────────────────────

// Themes excluded from scoring (they're structural, not thematic)
const EXCLUDED_THEMES = new Set(['Benchmark', 'Scan Only', 'Levered']);

// Extension thresholds (configurable via settings in Phase 5)
const EXTENSION_CONFIG = {
  tooHotAtrThreshold: 8.0,    // ≥8 ATR above 50DMA = too hot
  cleanMomentumAtrMin: 1.0,
  cleanMomentumAtrMax: 5.0,
  cleanMomentumMinVolRatio: 1.0,
  cleanMomentumMinRet5d: 0.0,
};

const BREADTH_CONFIG = {
  bigMoveThreshold: 0.04,  // 4% = "big move"
};

// Sector ETF labels for ETF pulse
const SECTOR_ETFS = {
  XLK: 'Technology', XLF: 'Financials', XLE: 'Energy',
  XLV: 'Healthcare', XLY: 'Discretionary', XLP: 'Staples',
  XLI: 'Industrials', XLU: 'Utilities', XLB: 'Materials',
  XLC: 'Comm Services', XLRE: 'Real Estate',
};

// ── Helper functions ─────────────────────────────────────────────────────────

function safePct(values) {
  const valid = values.filter(v => v === 0 || v === 1);
  if (valid.length === 0) return 0;
  return valid.reduce((s, v) => s + v, 0) / valid.length * 100;
}

function scaleTo100(value, low, high) {
  if (high === low) return 50;
  const pct = (value - low) / (high - low) * 100;
  return Math.max(0, Math.min(100, pct));
}

function avg(arr, key) {
  const valid = arr.filter(a => a[key] != null && !isNaN(a[key]));
  if (valid.length === 0) return 0;
  return valid.reduce((s, a) => s + a[key], 0) / valid.length;
}

function findAsset(assets, symbol) {
  return assets.find(a => a.symbol === symbol);
}

// ── Theme Scoring ────────────────────────────────────────────────────────────

/**
 * Compute per-theme scores with 4-component blend + status labels.
 *
 * Score = 30% breadth + 25% leadership + 30% momentum + 15% relative strength
 *
 * Status labels: DOMINANT / STRONG / STRONG-HOT / EMERGING / IMPROVING /
 *                NEUTRAL / DETERIORATING / FADING / WEAK
 *
 * @param {Array} assets — tradData.assets (each has metrics like above20, ret20d, etc.)
 * @param {Object|null} priorAssets — previous day's assets (for 1D score delta). If null, delta = 0.
 * @returns {Array} sorted theme scores with status labels
 */
export function computeThemeScores(assets, priorAssets = null) {
  // Group by category (TrendScan uses 'category' instead of SMB's 'theme')
  const themeMap = {};
  for (const a of assets) {
    const theme = a.category;
    if (!theme || EXCLUDED_THEMES.has(theme)) continue;
    if (!themeMap[theme]) themeMap[theme] = [];
    themeMap[theme].push(a);
  }

  // Compute prior theme scores for 1D delta
  const priorScores = {};
  if (priorAssets) {
    const priorMap = {};
    for (const a of priorAssets) {
      const theme = a.category;
      if (!theme || EXCLUDED_THEMES.has(theme)) continue;
      if (!priorMap[theme]) priorMap[theme] = [];
      priorMap[theme].push(a);
    }
    for (const [theme, group] of Object.entries(priorMap)) {
      if (group.length < 3) continue;
      priorScores[theme] = computeSingleThemeScore(group).score;
    }
  }

  const rows = [];
  for (const [theme, group] of Object.entries(themeMap)) {
    if (group.length < 3) continue;
    const scored = computeSingleThemeScore(group);
    const priorScore = priorScores[theme] ?? scored.score;
    const score1dDelta = scored.score - priorScore;

    // Status label
    const status = labelStatus(scored.score, score1dDelta, scored.extensionRaw);

    rows.push({
      theme,
      nNames: group.length,
      score: Math.round(scored.score * 10) / 10,
      status,
      breadth: Math.round(scored.breadth * 10) / 10,
      leadership: Math.round(scored.leadership * 10) / 10,
      momentum: Math.round(scored.momentum * 10) / 10,
      extensionRaw: Math.round(scored.extensionRaw * 100) / 100,
      pctAbove20ma: Math.round(scored.pctAbove20 * 10) / 10,
      pctAbove50ma: Math.round(scored.pctAbove50 * 10) / 10,
      pctAbove200ma: Math.round(scored.pctAbove200 * 10) / 10,
      pctNewHigh20d: Math.round(scored.pctNewHigh20 * 10) / 10,
      pctNewHigh52w: Math.round(scored.pctNewHigh52w * 10) / 10,
      avgRet5d: scored.avgRet5d,
      avgRet20d: scored.avgRet20d,
      avgAtrExt50ma: Math.round(scored.avgAtrExt * 100) / 100,
      avgRsQqq20d: scored.avgRsQqq,
      score1dDelta: Math.round(score1dDelta * 100) / 100,
      rank: 0,
    });
  }

  // Sort by score descending, assign rank
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });

  return rows;
}

function computeSingleThemeScore(group) {
  const pctAbove20 = safePct(group.map(a => a.above20));
  const pctAbove50 = safePct(group.map(a => a.above50));
  const pctAbove200 = safePct(group.map(a => a.above200));
  const pctNewHigh20 = safePct(group.map(a => a.newHigh20d));
  const pctNewHigh52w = safePct(group.map(a => a.newHigh52w));

  const avgRet5d = avg(group, 'ret5d');
  const avgRet20d = avg(group, 'ret20d');
  const avgAtrExt = avg(group, 'atrExt50ma');
  const avgRsQqq = avg(group, 'rs_qqq_20d');

  // Sub-scores (each 0-100)
  const breadth = (pctAbove20 + pctAbove50) / 2;
  const leadership = pctNewHigh20 * 0.6 + pctAbove200 * 0.4;
  const momentum = scaleTo100(avgRet20d, -0.10, 0.15);
  const extensionRaw = Math.max(0, Math.min(avgAtrExt, 15));

  // Final score: weighted blend
  // RS centered at 50, ±50% range (avgRsQqq * 500 scales it)
  const rsComponent = Math.max(0, Math.min(100, 50 + avgRsQqq * 500));
  const score = Math.max(0, Math.min(100,
    0.30 * breadth +
    0.25 * leadership +
    0.30 * momentum +
    0.15 * rsComponent
  ));

  return {
    score, breadth, leadership, momentum, extensionRaw,
    pctAbove20, pctAbove50, pctAbove200, pctNewHigh20, pctNewHigh52w,
    avgRet5d, avgRet20d, avgAtrExt, avgRsQqq,
  };
}

function labelStatus(score, delta, extension) {
  if (score >= 75 && extension > 6) return 'STRONG / HOT';
  if (score >= 75) return 'DOMINANT';
  if (score >= 60 && delta > 2) return 'EMERGING';
  if (score >= 60) return 'STRONG';
  if (score <= 35 && delta < -2) return 'FADING';
  if (score <= 35) return 'WEAK';
  if (delta > 3) return 'IMPROVING';
  if (delta < -3) return 'DETERIORATING';
  return 'NEUTRAL';
}

// ── Extension Lists ──────────────────────────────────────────────────────────

/**
 * Three lists: too_hot, clean_momentum, fading.
 *
 * @param {Array} assets — tradData.assets
 * @returns {Object} { tooHot, cleanMomentum, fading, thresholds }
 */
export function getExtensionLists(assets) {
  const { tooHotAtrThreshold, cleanMomentumAtrMin, cleanMomentumAtrMax,
          cleanMomentumMinVolRatio, cleanMomentumMinRet5d } = EXTENSION_CONFIG;

  // Filter to Core + Active tier (exclude Watch, Levered, Benchmark)
  const eligible = assets.filter(a =>
    (a.tier === 'Core' || a.tier === 'Active') &&
    a.atrExt50ma != null &&
    !EXCLUDED_THEMES.has(a.category)
  );

  // Too hot: ≥ N ATRs above 50DMA
  const tooHot = eligible
    .filter(a => a.atrExt50ma >= tooHotAtrThreshold)
    .sort((a, b) => (b.atrExt50ma ?? -999) - (a.atrExt50ma ?? -999))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol, name: a.name, category: a.category,
      atrExt50ma: a.atrExt50ma, ret1d: a.ret1d, ret5d: a.ret5d,
      distMa50: a.distMa50, price: a.price,
    }));

  // Clean momentum: above both MAs, positive 5D, ATR ext in range, vol > min
  const cleanMomentum = eligible
    .filter(a =>
      a.above20 === 1 && a.above50 === 1 &&
      a.ret5d > cleanMomentumMinRet5d &&
      a.atrExt50ma >= cleanMomentumAtrMin && a.atrExt50ma <= cleanMomentumAtrMax &&
      a.volRatio > cleanMomentumMinVolRatio
    )
    .sort((a, b) => (b.rs_qqq_20d ?? -999) - (a.rs_qqq_20d ?? -999))
    .slice(0, 25)
    .map(a => ({
      symbol: a.symbol, name: a.name, category: a.category,
      atrExt50ma: a.atrExt50ma, ret5d: a.ret5d, ret20d: a.ret20d,
      rsQqq20d: a.rs_qqq_20d, distMa50: a.distMa50, volRatio: a.volRatio,
      newHigh20d: a.newHigh20d, price: a.price,
    }));

  // Fading: lost 20DMA, negative 5D return < -3%
  const fading = eligible
    .filter(a => a.above20 === 0 && a.ret5d < -0.03)
    .sort((a, b) => (a.ret5d ?? 0) - (b.ret5d ?? 0))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol, name: a.name, category: a.category,
      ret5d: a.ret5d, ret20d: a.ret20d, distMa50: a.distMa50,
      atrExt50ma: a.atrExt50ma, price: a.price,
    }));

  return {
    tooHot, cleanMomentum, fading,
    thresholds: {
      tooHotAtr: tooHotAtrThreshold,
      cleanAtrMin: cleanMomentumAtrMin,
      cleanAtrMax: cleanMomentumAtrMax,
      cleanMinVol: cleanMomentumMinVolRatio,
      cleanMinRet5d: cleanMomentumMinRet5d,
    },
  };
}

// ── Regime Read ──────────────────────────────────────────────────────────────

/**
 * Top-level regime read: benchmark snapshot + universe breadth counts.
 *
 * @param {Array} assets — tradData.assets
 * @returns {Object} { benchmarks, breadth, thresholds }
 */
export function getRegimeRead(assets) {
  const bigMove = BREADTH_CONFIG.bigMoveThreshold;

  // Benchmark snapshot
  const benchSymbols = ['SPY', 'QQQ', 'IWM', 'RSP', 'DIA'];
  const benchmarks = benchSymbols
    .map(sym => {
      const a = findAsset(assets, sym);
      if (!a) return null;
      return {
        ticker: sym,
        ret1d: a.ret1d, ret5d: a.ret5d, ret20d: a.ret20d,
        distMa50: a.distMa50, atrExt50ma: a.atrExt50ma,
        above20: a.above20, above50: a.above50, above200: a.above200,
        price: a.price,
      };
    })
    .filter(Boolean);

  // Universe breadth (exclude Benchmark, Levered)
  const universe = assets.filter(a =>
    !EXCLUDED_THEMES.has(a.category) &&
    a.ret1d != null
  );

  const total = universe.length;
  const above20 = universe.filter(a => a.above20 === 1).length;
  const above50 = universe.filter(a => a.above50 === 1).length;
  const above200 = universe.filter(a => a.above200 === 1).length;
  const newHigh20d = universe.filter(a => a.newHigh20d === 1).length;
  const newHigh52w = universe.filter(a => a.newHigh52w === 1).length;
  const upBig = universe.filter(a => a.ret1d > bigMove).length;
  const downBig = universe.filter(a => a.ret1d < -bigMove).length;

  return {
    benchmarks,
    breadth: {
      total, above20, above50, above200,
      newHigh20d, newHigh52w, upBig, downBig,
      pctAbove20: total ? above20 / total * 100 : 0,
      pctAbove50: total ? above50 / total * 100 : 0,
      pctAbove200: total ? above200 / total * 100 : 0,
    },
    thresholds: { bigMovePct: bigMove * 100 },
  };
}

// ── ETF Pulse ────────────────────────────────────────────────────────────────

/**
 * Cross-asset ETF rotation read.
 *
 * Returns three groups:
 *   - styleRotation: 5 ratio pairs (IWM/SPY, RSP/SPY, QQQ/SPY, IWF/IWD, EEM/SPY)
 *   - riskPulse: HYG/TLT, GLD/SPY, UUP, UVXY, TLT
 *   - sectorRotation: 11 sector ETFs ranked by 20D RS vs SPY
 *
 * @param {Array} assets — tradData.assets
 * @returns {Object} { styleRotation, riskPulse, sectorRotation }
 */
export function getEtfPulse(assets) {
  // Style rotation pairs
  const stylePairs = [
    { num: 'IWM', den: 'SPY', label: 'Small vs Large' },
    { num: 'RSP', den: 'SPY', label: 'Equal vs Cap Weight' },
    { num: 'QQQ', den: 'SPY', label: 'Growth vs Broad' },
    { num: 'IWF', den: 'IWD', label: 'Growth vs Value' },
    { num: 'EEM', den: 'SPY', label: 'Emerging vs US' },
  ];
  const styleRotation = stylePairs
    .map(p => ratioPerf(assets, p.num, p.den, p.label))
    .filter(Boolean);

  // Risk pulse
  const riskItems = [
    { num: 'HYG', den: 'TLT', label: 'Junk vs Duration', context: 'risk-on when HYG > TLT' },
    { num: 'GLD', den: 'SPY', label: 'Gold vs Equities', context: 'risk-off when GLD > SPY' },
    { num: 'UUP', den: null, label: 'USD Strength', context: 'standalone' },
    { num: 'UVXY', den: null, label: 'VIX', context: 'standalone' },
    { num: 'TLT', den: null, label: 'Long Bonds', context: 'standalone' },
  ];
  const riskPulse = riskItems
    .map(item => {
      if (item.den === null) {
        const a = findAsset(assets, item.num);
        if (!a) return null;
        return {
          num: item.num, den: null, label: item.label, context: item.context,
          ret1d: a.ret1d, ret5d: a.ret5d, ret20d: a.ret20d, dist50ma: a.distMa50,
        };
      }
      return ratioPerf(assets, item.num, item.den, item.label, item.context);
    })
    .filter(Boolean);

  // Sector rotation — 11 sector ETFs ranked by 20D RS vs SPY
  const spy = findAsset(assets, 'SPY');
  const spy5d = spy?.ret5d ?? 0;
  const spy20d = spy?.ret20d ?? 0;

  const sectorRotation = Object.entries(SECTOR_ETFS)
    .map(([ticker, label]) => {
      const a = findAsset(assets, ticker);
      if (!a) return null;
      const ret5d = a.ret5d;
      const ret20d = a.ret20d;
      return {
        ticker, label,
        ret1d: a.ret1d, ret5d, ret20d,
        rsSpy5d: ret5d != null ? ret5d - spy5d : null,
        rsSpy20d: ret20d != null ? ret20d - spy20d : null,
        dist50ma: a.distMa50, above50: a.above50,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.rsSpy20d ?? -999) - (a.rsSpy20d ?? -999));

  return { styleRotation, riskPulse, sectorRotation };
}

function ratioPerf(assets, num, den, label, context) {
  const n = findAsset(assets, num);
  const d = findAsset(assets, den);
  if (!n || !d) return null;
  return {
    num, den, label,
    context: context || `${num} vs ${den}`,
    ret1d: (n.ret1d ?? 0) - (d.ret1d ?? 0),
    ret5d: (n.ret5d ?? 0) - (d.ret5d ?? 0),
    ret20d: (n.ret20d ?? 0) - (d.ret20d ?? 0),
    numRet1d: n.ret1d, denRet1d: d.ret1d,
    numRet5d: n.ret5d, denRet5d: d.ret5d,
    numRet20d: n.ret20d, denRet20d: d.ret20d,
  };
}

// ── Leadership Shifts ────────────────────────────────────────────────────────

/**
 * Top-N RS vs QQQ turnover: new entrants + dropouts vs prior period.
 * Low persistent count signals regime-level shift.
 *
 * @param {Array} assets — current tradData.assets
 * @param {Array|null} priorAssets — prior period assets (10D ago)
 * @param {number} topN — default 30
 * @returns {Object} { persistent, newEntrants, dropouts, topN }
 */
export function getLeadershipShifts(assets, priorAssets = null, topN = 30) {
  // Current top N by RS vs QQQ
  const currentTop = assets
    .filter(a => a.rs_qqq_20d != null)
    .sort((a, b) => (b.rs_qqq_20d ?? -999) - (a.rs_qqq_20d ?? -999))
    .slice(0, topN)
    .map(a => a.symbol);

  if (!priorAssets) {
    return { persistent: [], newEntrants: currentTop.map(s => ({ symbol: s })), dropouts: [], topN, hasPrior: false };
  }

  const priorTop = priorAssets
    .filter(a => a.rs_qqq_20d != null)
    .sort((a, b) => (b.rs_qqq_20d ?? -999) - (a.rs_qqq_20d ?? -999))
    .slice(0, topN)
    .map(a => a.symbol);

  const currentSet = new Set(currentTop);
  const priorSet = new Set(priorTop);

  const persistent = currentTop.filter(s => priorSet.has(s));
  const newEntrants = currentTop.filter(s => !priorSet.has(s)).map(s => {
    const a = findAsset(assets, s);
    return { symbol: s, name: a?.name, category: a?.category, rsQqq20d: a?.rs_qqq_20d };
  });
  const dropouts = priorTop.filter(s => !currentSet.has(s)).map(s => {
    const a = findAsset(priorAssets, s);
    return { symbol: s, name: a?.name, category: a?.category, rsQqq20d: a?.rs_qqq_20d };
  });

  return { persistent, newEntrants, dropouts, topN, hasPrior: true };
}

// ── New Highs / Lows ─────────────────────────────────────────────────────────

/**
 * Today's 52-week highs and lows.
 *
 * @param {Array} assets — tradData.assets
 * @param {number} limit — max items per list
 * @returns {Object} { newHighs, newLows }
 */
export function getNewHighsLows(assets, limit = 40) {
  const newHighs = assets
    .filter(a => a.newHigh52w === 1)
    .sort((a, b) => (b.ret1d ?? -999) - (a.ret1d ?? -999))
    .slice(0, limit)
    .map(a => ({
      symbol: a.symbol, name: a.name, category: a.category,
      price: a.price, ret1d: a.ret1d, ret5d: a.ret5d,
      pctFrom52wHigh: a.pctFrom52wHigh,
    }));

  // New lows: assets at or near their 52-week low
  const newLows = assets
    .filter(a => a.low52w != null && a.price != null && a.price <= a.low52w * 1.02)
    .sort((a, b) => (a.pctFrom52wHigh ?? 0) - (b.pctFrom52wHigh ?? 0))
    .slice(0, limit)
    .map(a => ({
      symbol: a.symbol, name: a.name, category: a.category,
      price: a.price, ret1d: a.ret1d, ret5d: a.ret5d,
      pctFrom52wHigh: a.pctFrom52wHigh,
    }));

  return { newHighs, newLows };
}

// ── Gap Scan ─────────────────────────────────────────────────────────────────

/**
 * Daily gap scanner.
 * Gap up: today's open > prior high AND gap ≥ 2%
 * Gap down: today's open < prior low AND gap ≤ -2%
 *
 * Note: Requires OHLC candle data, not just metrics. This function expects
 * assets to have `candles` attached (the raw candle array).
 *
 * @param {Array} assets — each asset should have .candles (array of {o,h,l,c})
 * @param {number} minGapPct — minimum gap % (default 2.0)
 * @returns {Object} { gapUps, gapDowns }
 */
export function getGapScan(assets, minGapPct = 2.0) {
  const gapUps = [];
  const gapDowns = [];

  for (const a of assets) {
    if (!a.candles || a.candles.length < 2) continue;
    const today = a.candles[a.candles.length - 1];
    const prior = a.candles[a.candles.length - 2];
    if (!today?.o || !prior?.h || !prior?.l) continue;

    const gapUpPct = (today.o / prior.h - 1) * 100;
    const gapDownPct = (today.o / prior.l - 1) * 100;

    if (gapUpPct >= minGapPct) {
      const heldPct = today.c > 0 ? (today.c / today.o - 1) * 100 : 0;
      gapUps.push({
        symbol: a.symbol, name: a.name, category: a.category,
        gapPct: gapUpPct, heldPct, price: a.price, open: today.o, close: today.c,
      });
    } else if (gapDownPct <= -minGapPct) {
      const heldPct = today.c > 0 ? (today.c / today.o - 1) * 100 : 0;
      gapDowns.push({
        symbol: a.symbol, name: a.name, category: a.category,
        gapPct: gapDownPct, heldPct, price: a.price, open: today.o, close: today.c,
      });
    }
  }

  gapUps.sort((a, b) => b.gapPct - a.gapPct);
  gapDowns.sort((a, b) => a.gapPct - b.gapPct);

  return { gapUps, gapDowns };
}
