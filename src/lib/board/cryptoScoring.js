/**
 * cryptoScoring.js — Crypto theme scoring + extension lists + leadership shifts.
 *
 * Adapted from tradfiScoring.js for the crypto universe. Uses BTC as the
 * benchmark instead of QQQ (and ETH as secondary benchmark instead of RSP).
 *
 * The crypto Board already has themes (DeFi, AI, Memes, Layer 1, etc.) and
 * already computes newHigh20d, newHigh52w, rs_btc_20d in boardEngine.js.
 * This module adds the full SMB 4-component scoring blend:
 *   30% breadth + 25% leadership + 30% momentum + 15% RS vs BTC
 *
 * Crypto-specific thresholds (wider than tradfi due to higher volatility):
 *   - too_hot_atr_threshold: 12 (vs 8 for tradfi)
 *   - big_move_threshold: 8% (vs 4% for tradfi)
 *   - momentum_scale: [-20%, +30%] (vs [-10%, +15%] for tradfi)
 */

// ── Constants ────────────────────────────────────────────────────────────────

const EXCLUDED_THEMES = new Set(['Stablecoin', 'Wrapped']);

const CRYPTO_EXTENSION_CONFIG = {
  tooHotAtrThreshold: 12.0,    // crypto is more volatile — 12 ATR instead of 8
  cleanMomentumAtrMin: 1.0,
  cleanMomentumAtrMax: 8.0,    // wider range than tradfi (5)
  cleanMomentumMinVolRatio: 1.0,
  cleanMomentumMinRet5d: 0.0,
};

const CRYPTO_BREADTH_CONFIG = {
  bigMoveThreshold: 0.08,  // 8% = "big move" for crypto (4% for tradfi)
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

// ── Theme Scoring ────────────────────────────────────────────────────────────

/**
 * Compute per-theme scores for crypto using the full SMB 4-component blend.
 *
 * Score = 30% breadth + 25% leadership + 30% momentum + 15% RS vs BTC
 *
 * @param {Array} assets — crypto assets from boardEngine (each has theme, above20, above50, ret5d, ret20d, newHigh20d, rs_btc_20d, atrExt50ma, etc.)
 * @param {Object|null} priorScores — previous theme scores for 1D delta
 * @returns {Array} sorted theme scores with status labels
 */
export function computeCryptoThemeScores(assets, priorScores = null) {
  // Group by theme
  const themeMap = {};
  for (const a of assets) {
    const theme = a.theme;
    if (!theme || EXCLUDED_THEMES.has(theme)) continue;
    if (!themeMap[theme]) themeMap[theme] = [];
    themeMap[theme].push(a);
  }

  const rows = [];
  for (const [theme, group] of Object.entries(themeMap)) {
    if (group.length < 3) continue;

    const pctAbove20 = safePct(group.map(a => a.above20));
    const pctAbove50 = safePct(group.map(a => a.above50));
    const pctAbove200 = safePct(group.map(a => a.above200));
    const pctNewHigh20 = safePct(group.map(a => a.newHigh20d));
    const pctNewHigh52w = safePct(group.map(a => a.newHigh52w));

    const avgRet5d = avg(group, 'ret5d');
    const avgRet20d = avg(group, 'ret20d');
    const avgAtrExt = avg(group, 'atrExt50ma');
    const avgRsBtc = avg(group, 'rs_btc_20d');

    // Sub-scores (each 0-100)
    const breadth = (pctAbove20 + pctAbove50) / 2;
    const leadership = pctNewHigh20 * 0.6 + pctAbove200 * 0.4;
    // Crypto momentum scale: wider than tradfi [-20%, +30%]
    const momentum = scaleTo100(avgRet20d, -0.20, 0.30);
    const extensionRaw = Math.max(0, Math.min(avgAtrExt, 20));

    // RS centered at 50, ±50% range
    const rsComponent = Math.max(0, Math.min(100, 50 + avgRsBtc * 500));
    const score = Math.max(0, Math.min(100,
      0.30 * breadth +
      0.25 * leadership +
      0.30 * momentum +
      0.15 * rsComponent
    ));

    const priorScore = priorScores?.[theme] ?? score;
    const score1dDelta = score - priorScore;
    const status = labelStatus(score, score1dDelta, extensionRaw);

    rows.push({
      theme,
      nNames: group.length,
      score: Math.round(score * 10) / 10,
      status,
      breadth: Math.round(breadth * 10) / 10,
      leadership: Math.round(leadership * 10) / 10,
      momentum: Math.round(momentum * 10) / 10,
      extensionRaw: Math.round(extensionRaw * 100) / 100,
      pctAbove20ma: Math.round(pctAbove20 * 10) / 10,
      pctAbove50ma: Math.round(pctAbove50 * 10) / 10,
      pctAbove200ma: Math.round(pctAbove200 * 10) / 10,
      pctNewHigh20d: Math.round(pctNewHigh20 * 10) / 10,
      pctNewHigh52w: Math.round(pctNewHigh52w * 10) / 10,
      avgRet5d,
      avgRet20d,
      avgAtrExt50ma: Math.round(avgAtrExt * 100) / 100,
      avgRsBtc20d: avgRsBtc,
      score1dDelta: Math.round(score1dDelta * 100) / 100,
      rank: 0,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function labelStatus(score, delta, extension) {
  if (score >= 75 && extension > 8) return 'STRONG / HOT';  // crypto threshold higher
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
 * Three lists: tooHot, cleanMomentum, fading — with crypto-appropriate thresholds.
 *
 * @param {Array} assets — crypto assets from boardEngine
 * @returns {Object} { tooHot, cleanMomentum, fading, thresholds }
 */
export function getCryptoExtensionLists(assets) {
  const { tooHotAtrThreshold, cleanMomentumAtrMin, cleanMomentumAtrMax,
          cleanMomentumMinVolRatio, cleanMomentumMinRet5d } = CRYPTO_EXTENSION_CONFIG;

  const eligible = assets.filter(a =>
    a.atrExt50ma != null && !EXCLUDED_THEMES.has(a.theme)
  );

  // Too hot: ≥ N ATRs above 50DMA (12 for crypto vs 8 for tradfi)
  const tooHot = eligible
    .filter(a => a.atrExt50ma >= tooHotAtrThreshold)
    .sort((a, b) => (b.atrExt50ma ?? -999) - (a.atrExt50ma ?? -999))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol, name: a.name, theme: a.theme,
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
    .sort((a, b) => (b.rs_btc_20d ?? -999) - (a.rs_btc_20d ?? -999))
    .slice(0, 25)
    .map(a => ({
      symbol: a.symbol, name: a.name, theme: a.theme,
      atrExt50ma: a.atrExt50ma, ret5d: a.ret5d, ret20d: a.ret20d,
      rsBtc20d: a.rs_btc_20d, distMa50: a.distMa50, volRatio: a.volRatio,
      newHigh20d: a.newHigh20d, price: a.price,
    }));

  // Fading: lost 20DMA, 5D return < -5% (crypto threshold, -3% for tradfi)
  const fading = eligible
    .filter(a => a.above20 === 0 && a.ret5d < -0.05)
    .sort((a, b) => (a.ret5d ?? 0) - (b.ret5d ?? 0))
    .slice(0, 20)
    .map(a => ({
      symbol: a.symbol, name: a.name, theme: a.theme,
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

// ── Leadership Shifts ────────────────────────────────────────────────────────

/**
 * Top-N RS vs BTC turnover: new entrants + dropouts vs prior period.
 *
 * @param {Array} assets — current crypto assets
 * @param {Array|null} priorAssets — prior period assets
 * @param {number} topN — default 30
 * @returns {Object} { persistent, newEntrants, dropouts, topN }
 */
export function getCryptoLeadershipShifts(assets, priorAssets = null, topN = 30) {
  const currentTop = assets
    .filter(a => a.rs_btc_20d != null)
    .sort((a, b) => (b.rs_btc_20d ?? -999) - (a.rs_btc_20d ?? -999))
    .slice(0, topN)
    .map(a => a.symbol);

  if (!priorAssets) {
    return { persistent: [], newEntrants: currentTop.map(s => ({ symbol: s })), dropouts: [], topN, hasPrior: false };
  }

  const priorTop = priorAssets
    .filter(a => a.rs_btc_20d != null)
    .sort((a, b) => (b.rs_btc_20d ?? -999) - (a.rs_btc_20d ?? -999))
    .slice(0, topN)
    .map(a => a.symbol);

  const currentSet = new Set(currentTop);
  const priorSet = new Set(priorTop);

  const persistent = currentTop.filter(s => priorSet.has(s));
  const newEntrants = currentTop.filter(s => !priorSet.has(s)).map(s => {
    const a = assets.find(x => x.symbol === s);
    return { symbol: s, name: a?.name, theme: a?.theme, rsBtc20d: a?.rs_btc_20d };
  });
  const dropouts = priorTop.filter(s => !currentSet.has(s)).map(s => {
    const a = priorAssets.find(x => x.symbol === s);
    return { symbol: s, name: a?.name, theme: a?.theme, rsBtc20d: a?.rs_btc_20d };
  });

  return { persistent, newEntrants, dropouts, topN, hasPrior: true };
}

// ── Regime Read (crypto) ─────────────────────────────────────────────────────

/**
 * Crypto regime read: BTC/ETH benchmark snapshot + universe breadth.
 *
 * @param {Array} assets — crypto assets
 * @returns {Object} { benchmarks, breadth, thresholds }
 */
export function getCryptoRegimeRead(assets) {
  const bigMove = CRYPTO_BREADTH_CONFIG.bigMoveThreshold;

  const benchSymbols = ['BTC', 'ETH', 'SOL'];
  const benchmarks = benchSymbols
    .map(sym => {
      const a = assets.find(x => x.symbol === sym);
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

  const universe = assets.filter(a =>
    !EXCLUDED_THEMES.has(a.theme) && a.ret1d != null
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
