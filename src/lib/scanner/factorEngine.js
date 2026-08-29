/**
 * Crypto Factor Engine — borrows factorwatch.ai's factor methodology, adapted for crypto.
 *
 * factorwatch tracks 7 equity factors (momentum, value, quality, size, low-vol,
 * high-beta, div-yield). Crypto has no earnings/dividends, so we adapt:
 *
 *   Crypto Factor          | Computation                              | Analog
 *   -----------------------|------------------------------------------|--------
 *   momentum_12_1          | P(t-21d) / P(t-252d) - 1                 | Momentum (12-1mo)
 *   size                   | -log(market cap)                         | Size (small = high score)
 *   volatility             | -std(daily returns, 30d)                 | Low Volatility
 *   beta_to_btc            | OLS β vs BTC, 90d daily returns          | High Beta (we take inverse)
 *   liquidity              | log(30d USD volume / market cap)         | Liquidity (turnover)
 *
 * Quintile construction (factorwatch-style):
 *   - Sort top 100 by mcap, compute factor scores, split into 5 quintiles
 *   - Long-only (Q5, cap-weighted, 5% single-name cap)
 *   - Spread (Q5 - Q1, equal-weighted)
 *   - Benchmark = full universe cap-weighted
 *   - Monthly rebalance, buy-and-hold between rebalances
 *
 * Spread monitor (factorwatch-style):
 *   - For each factor: compute h-day return (1d, 5d, 20d, 60d)
 *   - Z-score vs trailing 252 overlapping h-day returns
 *   - Report |z| >= 2 as a flag
 */

import { mean, stddev } from '../regime/regimeCalculations.js';
import { pairHorizonReturnWithStats, pairYtdReturn } from '../regime/regimePercentile.js';

// ─── Factor Score Computations ────────────────────────────────────────────────

/**
 * Compute factor scores for a universe of crypto assets.
 *
 * @param {Array<{symbol, candles: Array<{ts,close,vol}>, marketCap}>} universe
 * @returns {Array<{symbol, scores: {momentum, size, volatility, beta, liquidity}}>}
 */
export function computeFactorScores(universe) {
  if (!universe || universe.length === 0) return [];

  // Need BTC for beta calculation
  const btc = universe.find(u => u.symbol === 'BTC');
  if (!btc?.candles) return [];

  const btcReturns = computeDailyReturns(btc.candles);

  const scored = universe.map(asset => {
    if (!asset.candles || asset.candles.length < 30) return null;

    const closes = asset.candles.map(c => c.close);
    const returns = computeDailyReturns(asset.candles);

    const scores = {};

    // 1. Momentum 12-1mo: P(t-21d) / P(t-252d) - 1
    // Clamp to [-0.95, 5.0] to prevent extreme outliers from skewing quintiles
    // NOTE: requires closes.length >= 253 to safely index closes[length-253] (audit F-14-e-1).
    if (closes.length >= 253) {
      const p21 = closes[closes.length - 22];
      const p252 = closes[closes.length - 253];
      scores.momentum = Math.max(-0.95, Math.min(5.0, (p21 / p252) - 1));
    } else if (closes.length >= 30) {
      // Fallback for short histories: skip last 21 days to preserve the short-term-reversal
      // skip that defines 12-1mo momentum (audit F-14-b-7).
      const skipIdx = Math.max(0, closes.length - 22);
      scores.momentum = Math.max(-0.95, Math.min(5.0, (closes[skipIdx] / closes[0]) - 1));
    }

    // 2. Size: -log(market cap) — small cap = high score
    if (asset.marketCap > 0) {
      scores.size = -Math.log(asset.marketCap);
    }

    // 3. Volatility: -std(daily returns, 30d)
    if (returns.length >= 30) {
      scores.volatility = -stddev(returns.slice(-30));
    }

    // 4. Beta to BTC: OLS β over 90d
    if (returns.length >= 30 && btcReturns.length >= 30) {
      const minLen = Math.min(returns.length, btcReturns.length, 90);
      const r = returns.slice(-minLen);
      const b = btcReturns.slice(-minLen);
      scores.beta = 1 - computeBeta(r, b);  // inverse: low beta = high score
    }

    // 5. Liquidity: log(30d volume / market cap)
    // Clamp to [-10, 5] to prevent extreme values from near-zero or huge volume/mcap ratios
    if (asset.marketCap > 0 && asset.candles.length >= 30) {
      const recentVol = asset.candles.slice(-30).reduce((s, c) => s + (c.vol * c.close), 0);
      const ratio = recentVol / asset.marketCap;
      scores.liquidity = Math.max(-10, Math.min(5, Math.log(Math.max(ratio, 1e-10))));
    }

    return { symbol: asset.symbol, scores };
  }).filter(Boolean);

  return scored;
}

function computeDailyReturns(candles) {
  const out = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close && candles[i - 1].close) {
      out.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
    }
  }
  return out;
}

function computeBeta(assetReturns, marketReturns) {
  if (assetReturns.length < 5 || assetReturns.length !== marketReturns.length) return 1;
  const n = assetReturns.length;
  const am = mean(assetReturns);
  const bm = mean(marketReturns);
  let cov = 0, varm = 0;
  for (let i = 0; i < n; i++) {
    cov += (assetReturns[i] - am) * (marketReturns[i] - bm);
    varm += (marketReturns[i] - bm) ** 2;
  }
  if (varm === 0) return 1;
  return cov / varm;
}

// ─── Winsorization + Z-Score ──────────────────────────────────────────────────

function winsorize(arr, lower = 0.025, upper = 0.975) {
  if (arr.length < 5) return [...arr];
  const sorted = [...arr].sort((a, b) => a - b);
  const loIdx = Math.floor(sorted.length * lower);
  // Audit (2026-08-29): clamp hiIdx to the last valid index. For arrays
  // shorter than 40, Math.ceil(n * 0.975) === n, so the old code read
  // sorted[n] — undefined — and every winsorized value became NaN, which
  // silently destroyed the quintile sort for any factor universe under
  // 40 assets (e.g. when candle coverage is thin).
  const hiIdx = Math.min(Math.ceil(sorted.length * upper), sorted.length - 1);
  const lo = sorted[loIdx];
  const hi = sorted[hiIdx];
  return arr.map(v => Math.max(lo, Math.min(hi, v)));
}

function zScore(arr) {
  if (arr.length < 2) return arr.map(() => 0);
  const m = mean(arr);
  const sd = stddev(arr, m) || 1;
  return arr.map(v => (v - m) / sd);
}

// ─── Quintile Portfolio Construction ──────────────────────────────────────────

/**
 * Build quintile portfolios for a single factor.
 *
 * @param {Array<{symbol, scores}>} scoredUniverse
 * @param {string} factorName
 * @returns {{
 *   quintiles: Array<Array<string>>,  // [Q1, Q2, Q3, Q4, Q5] each is array of symbols
 *   longOnly: string[],               // Q5 (top quintile)
 *   shortOnly: string[],              // Q1 (bottom quintile)
 *   spread: string[],                 // longOnly minus shortOnly (for tracking)
 * }}
 */
export function buildQuintilePortfolios(scoredUniverse, factorName) {
  // Filter to assets with a score for this factor
  const withScore = scoredUniverse
    .filter(a => a.scores[factorName] != null && Number.isFinite(a.scores[factorName]))
    .map(a => ({ symbol: a.symbol, score: a.scores[factorName] }));

  if (withScore.length < 10) {
    return { quintiles: [[], [], [], [], []], longOnly: [], shortOnly: [], spread: [] };
  }

  // Winsorize + z-score (factorwatch §3)
  const scores = winsorize(withScore.map(a => a.score));
  const zScores = zScore(scores);
  const withZ = withScore.map((a, i) => ({ ...a, z: zScores[i] }));

  // Audit (2026-08-29, "Factor Monitor always WAIT"): sort direction was
  // descending (b.z - a.z), which put the HIGHEST-scoring assets in
  // quintiles[0] — but quintiles[0] is assigned to shortOnly ("Q1") and
  // quintiles[4] to longOnly ("Q5"). Result: every factor's long book held
  // the LOWEST-scoring quintile and the short book the highest — the entire
  // factor table (spreads, rotation leader, quilt) was sign-inverted for its
  // whole life. E.g. "Low Volatility" Q5 held the highest-volatility alts
  // while stablecoins sat in Q1; "Momentum" longed the biggest losers.
  //
  // Fix: sort ASCENDING so quintiles[0] = lowest score (= Q1, short book)
  // and quintiles[4] = highest score (= Q5, long book), exactly what the
  // comments below and every downstream consumer assume. The integer
  // remainder (universe sizes not divisible by 5) lands in quintiles[4] —
  // the top quintile — which is the factorwatch convention.
  withZ.sort((a, b) => a.z - b.z);

  // Split into 5 quintiles
  const quintileSize = Math.floor(withZ.length / 5);
  const quintiles = [];
  for (let q = 0; q < 5; q++) {
    const start = q * quintileSize;
    const end = q === 4 ? withZ.length : start + quintileSize;
    quintiles.push(withZ.slice(start, end).map(a => a.symbol));
  }

  return {
    quintiles,
    longOnly: quintiles[4],    // Q5 = top quintile
    shortOnly: quintiles[0],   // Q1 = bottom quintile
    spread: [...quintiles[4], ...quintiles[0]],  // for tracking
  };
}

// ─── Spread Monitor (factorwatch-style z-score table) ─────────────────────────

/**
 * For each factor, compute h-day returns and z-scores for both:
 *   - rel (Q5 long-only minus benchmark)
 *   - spread (Q5 minus Q1)
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): this previously built
 * difference series (longNorm − shortNorm via subtractSeries) and fed them
 * to horizonReturnWithStats, which computes (end−start)/start — a division
 * by a difference series that starts at 0 and crosses zero. The baseline of
 * trailing windows filled with ±400% small-denominator artifacts, inflating
 * the stdev and deflating every z-score below the |z|≥2 stretch gate, so
 * every stance resolved to WAIT forever. It also produced nonsense "returns"
 * like +252% for a 20d spread and +1000% (clamped) for rel.
 *
 * Now each h-day stat is the arithmetic pair return
 *     pairRet_h = A[t]/A[t−h] − B[t]/B[t−h]
 * computed at every trailing window (see pairHorizonReturnWithStats), which
 * is the standard long-short portfolio return and never divides by a
 * difference. rel uses (long, benchmark); spread uses (long, short).
 *
 * @param {object} portfoliosByFactor  - { momentum: {longOnly, shortOnly}, size: {...}, ... }
 * @param {object} candlesBySymbol     - { BTC: [{ts,close},...], ETH: [...], ... }
 * @param {Array<string>} benchmarkUniverse  - array of symbol strings (e.g. ['BTC','ETH','SOL'])
 * @returns {object} spread monitor data
 */
export function computeSpreadMonitor(portfoliosByFactor, candlesBySymbol, benchmarkUniverse) {
  const factors = Object.keys(portfoliosByFactor);
  const horizons = [1, 5, 20, 60];
  const result = {};

  // Build benchmark price series (equal-weighted average of all symbols with data)
  const benchmarkSeries = buildEqualWeightSeries(benchmarkUniverse, candlesBySymbol);

  for (const factor of factors) {
    const { longOnly, shortOnly } = portfoliosByFactor[factor];
    const longSeries = buildEqualWeightSeries(longOnly, candlesBySymbol);
    const shortSeries = buildEqualWeightSeries(shortOnly, candlesBySymbol);

    const factorData = { factor, label: formatFactorLabel(factor) };

    for (const h of horizons) {
      // rel = long-only minus benchmark (what an ETF-vs-benchmark watcher sees)
      factorData[`rel_${h}d`] = pairHorizonReturnWithStats(longSeries, benchmarkSeries, h)
        || { ret: null, z: null, pctile: null };
      // spread = long minus short (the cleaner factor signal)
      factorData[`spread_${h}d`] = pairHorizonReturnWithStats(longSeries, shortSeries, h)
        || { ret: null, z: null, pctile: null };
    }

    // YTD returns — same pair-return definition as the h-day stats
    // (long leg vs benchmark / short leg, start-of-year to now).
    //
    // Audit F-14-e-3 (2026-08-26) made spread_ytd the ABSOLUTE change of the
    // difference series because dividing difference levels blew up. With the
    // pair-return definition there is no division of a difference at all, so
    // YTD can use the same clean excess-return formula as every other cell
    // and stay consistent with them.
    if (longSeries.length > 0) {
      factorData.rel_ytd = { ret: pairYtdReturn(longSeries, benchmarkSeries) };
      factorData.spread_ytd = { ret: pairYtdReturn(longSeries, shortSeries) };
    }

    result[factor] = factorData;
  }

  return result;
}

// Audit F-14-e-10 (2026-08-26): detectIdenticalQuintiles removed — zero callers
// (was a diagnostic stub that just console.warn'd, no real effect on output).

function formatFactorLabel(factor) {
  const map = {
    momentum: 'Momentum (12-1mo)',
    size: 'Size (small cap)',
    volatility: 'Low Volatility',
    beta: 'Low Beta to BTC',
    liquidity: 'Liquidity (turnover)',
  };
  return map[factor] || factor;
}

/**
 * Build an equal-weighted price series from a list of symbols.
 * Normalizes each symbol's series to start at 1.0 (so equal weighting makes sense).
 */
function buildEqualWeightSeries(symbols, candlesBySymbol) {
  if (!symbols || symbols.length === 0) return [];
  const seriesBySymbol = symbols
    .map(s => candlesBySymbol[s])
    .filter(c => c && c.length > 0);
  if (seriesBySymbol.length === 0) return [];

  // Find common length
  const minLen = Math.min(...seriesBySymbol.map(s => s.length));

  // Normalize each series to start at 1.0
  // Clamp values to [0.01, 50] to prevent extreme outliers from dominating the average
  // (a coin that pumped 5000x would otherwise make the equal-weight average meaningless)
  const normalized = seriesBySymbol.map(s => {
    const start = s[s.length - minLen].close;
    if (!start || start <= 0) return null;
    return s.slice(s.length - minLen).map(c => ({
      ts: c.ts,
      value: Math.max(0.01, Math.min(50, c.close / start))
    }));
  }).filter(Boolean);

  // Average across symbols
  const out = [];
  for (let i = 0; i < minLen; i++) {
    const sum = normalized.reduce((acc, s) => acc + s[i].value, 0);
    out.push({
      ts: normalized[0][i].ts,
      value: sum / normalized.length,
    });
  }
  return out.map(p => p.value);  // return just the values array for horizonReturnWithStats
}

// Audit (2026-08-29): subtractSeries removed — its only caller
// (computeSpreadMonitor) now computes pair returns directly from the two
// leg series (pairHorizonReturnWithStats), which is the mathematically
// correct long-short return. The difference-series construction was the
// root cause of the deflated z-scores (see computeSpreadMonitor docstring).

// ─── Rotation Detector (factorwatch §6) ───────────────────────────────────────

/**
 * Compute a backfilled {date, leader} leadership history from the current
 * candle data — the leader (highest trailing-20d long-only return) as of
 * each of the last `days` sessions.
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): the accumulated daily
 * history is the input to rotation detection (3-session confirm), but it
 * only grows one entry per snapshot run — leaving rotation cold-started for
 * weeks on a new deployment, and stale after a correctness fix invalidates
 * old entries. Since we hold a full year of candles at build time, the
 * leadership history can be reconstructed for the trailing window directly.
 * Uses current quintile membership applied backwards (the same
 * approximation the crowding matrix backfill makes).
 *
 * Series alignment: each factor's long-only series is truncated to the
 * trailing common length, so index-from-the-end is date-aligned across
 * factors (all series end at the latest candle).
 *
 * @param {object} portfoliosByFactor
 * @param {object} candlesBySymbol
 * @param {number} [days=90] - how many sessions to reconstruct
 * @returns {Array<{date: string, leader: string}>} oldest first
 */
export function computeLeadershipHistory(portfoliosByFactor, candlesBySymbol, days = 90) {
  const factors = Object.keys(portfoliosByFactor);
  if (factors.length === 0) return [];

  // Long-only value series per factor, each truncated to the TRAILING common
  // length so index-from-the-end is date-aligned across factors.
  const seriesByFactor = {};
  let minLen = Infinity;
  for (const factor of factors) {
    const series = buildEqualWeightSeries(portfoliosByFactor[factor].longOnly, candlesBySymbol);
    if (series.length < minLen) minLen = series.length;
    seriesByFactor[factor] = series;
  }
  if (!Number.isFinite(minLen) || minLen < 21) return [];
  for (const factor of factors) {
    seriesByFactor[factor] = seriesByFactor[factor].slice(-minLen);
  }

  // Latest candle timestamp across the universe (for date labels)
  let latestTs = 0;
  for (const candles of Object.values(candlesBySymbol)) {
    const last = candles[candles.length - 1];
    if (last?.ts && last.ts > latestTs) latestTs = last.ts;
  }
  if (!latestTs) return [];

  const out = [];
  const n = Math.min(days, minLen - 20);
  for (let k = 0; k < n; k++) {
    const endIdx = minLen - 1 - k;   // index counted from the shared end
    if (endIdx < 20) break;
    let leader = null, best = -Infinity;
    for (const factor of factors) {
      const series = seriesByFactor[factor];
      const ret = (series[endIdx] / series[endIdx - 20]) - 1;
      if (Number.isFinite(ret) && ret > best) {
        best = ret;
        leader = factor;
      }
    }
    if (leader) {
      const ts = latestTs - k * 86400000;
      out.push({ date: new Date(ts).toISOString().slice(0, 10), leader });
    }
  }
  return out.reverse();  // oldest first, matching appendToHistory's shape
}

/**
 * Detect factor rotation based on trailing-20d returns of long-only portfolios.
 *
 * Snapshot-only implementation: returns the current leader and trailing
 * 20-day returns per factor. Full rotation detection (with held-days
 * count, flip detection, etc.) requires daily history persistence and
 * is not yet implemented.
 *
 * @param {object} portfoliosByFactor
 * @param {object} candlesBySymbol
 * @returns {{
 *   leader_20d: string,
 *   leader_held_days: number,
 *   flipped_from: string|null,
 *   flip_flag: boolean,
 *   trailing_20d_returns: object,
 * }}
 */
export function detectFactorRotation(portfoliosByFactor, candlesBySymbol) {
  const factors = Object.keys(portfoliosByFactor);
  const trailingReturns = {};

  for (const factor of factors) {
    const { longOnly } = portfoliosByFactor[factor];
    const series = buildEqualWeightSeries(longOnly, candlesBySymbol);
    if (series.length >= 21) {
      const ret20 = (series[series.length - 1] / series[series.length - 21]) - 1;
      trailingReturns[factor] = ret20;
    } else {
      trailingReturns[factor] = 0;
    }
  }

  // Find leader (highest 20d return)
  const sorted = Object.entries(trailingReturns).sort((a, b) => b[1] - a[1]);
  const leader = sorted[0]?.[0] || null;

  return {
    leader_20d: leader,
    // Snapshot-only fields — full rotation detection (with held-days count,
    // flip detection) requires daily history persistence not yet implemented.
    // These defaults match the documented return type so callers don't break.
    leader_held_days: 0,
    flipped_from: null,
    flip_flag: false,
    trailing_20d_returns: trailingReturns,
  };
}

// ─── Quilt (calendar-month ranked returns) ────────────────────────────────────

/**
 * Build a 13-month performance quilt for factor long-only portfolios.
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): month buckets were
 * approximated by series INDEX (i / 30) and month labels were synthesized by
 * walking `new Date()` backwards — independently per factor. Factors with
 * different history lengths generated different labels for the same calendar
 * month, so the label-based month matching in this function failed for most
 * cells and the quilt displayed mostly 0.0% (a false "flat") instead of the
 * real monthly returns. Now months are derived from the candles' real
 * timestamps, so every factor buckets by the same calendar month and
 * missing months surface as null (rendered '—') rather than a fake 0.
 *
 * @returns {Array<{month: 'YYYY-MM', ranking: Array<{factor, return}>}>}
 */
export function buildQuilt(portfoliosByFactor, candlesBySymbol) {
  const factors = Object.keys(portfoliosByFactor);
  const monthlyReturns = {};  // factor → [{month, return}]

  for (const factor of factors) {
    const { longOnly } = portfoliosByFactor[factor];
    const series = buildEqualWeightSeriesWithTs(longOnly, candlesBySymbol);
    if (series.length < 60) continue;
    monthlyReturns[factor] = computeMonthlyReturns(series);
  }

  // Get all unique months across factors
  const allMonths = new Set();
  for (const factor of factors) {
    for (const m of (monthlyReturns[factor] || [])) allMonths.add(m.month);
  }

  const sortedMonths = [...allMonths].sort().slice(-13);  // last 13 months
  const quilt = [];

  for (const month of sortedMonths) {
    const ranking = factors
      .map(factor => {
        const entry = (monthlyReturns[factor] || []).find(m => m.month === month);
        return {
          factor,
          label: formatFactorLabel(factor),
          // null (not 0) when this factor has no data for the month —
          // FactorQuilt renders null as '—' instead of a false 0.0%.
          return: entry?.return ?? null,
        };
      })
      .sort((a, b) => (b.return ?? -Infinity) - (a.return ?? -Infinity));
    quilt.push({ month, ranking });
  }

  return quilt;
}

/**
 * Build an equal-weighted price series that KEEPS timestamps.
 * Same normalization/clamping as buildEqualWeightSeries, but returns
 * [{ts, value}] so downstream code (the quilt) can bucket by real date
 * instead of approximating months from array indices.
 */
function buildEqualWeightSeriesWithTs(symbols, candlesBySymbol) {
  if (!symbols || symbols.length === 0) return [];
  const seriesBySymbol = symbols
    .map(s => candlesBySymbol[s])
    .filter(c => c && c.length > 0);
  if (seriesBySymbol.length === 0) return [];

  // Find common length
  const minLen = Math.min(...seriesBySymbol.map(s => s.length));

  // Normalize each series to start at 1.0 (same clamp as buildEqualWeightSeries)
  const normalized = seriesBySymbol.map(s => {
    const start = s[s.length - minLen].close;
    if (!start || start <= 0) return null;
    return s.slice(s.length - minLen).map(c => ({
      ts: c.ts,
      value: Math.max(0.01, Math.min(50, c.close / start)),
    }));
  }).filter(Boolean);

  if (normalized.length === 0) return [];

  // Average across symbols, keeping the first symbol's timestamp per index
  // (all series are daily and index-aligned by construction — same
  // assumption buildEqualWeightSeries makes).
  const out = [];
  for (let i = 0; i < minLen; i++) {
    const sum = normalized.reduce((acc, s) => acc + s[i].value, 0);
    out.push({
      ts: normalized[0][i].ts,
      value: sum / normalized.length,
    });
  }
  return out;
}

function computeMonthlyReturns(tsSeries) {
  if (!tsSeries || tsSeries.length < 30) return [];

  // Group by real calendar month (UTC), tracking first/last value of each.
  // A month's return uses the value on the last day of the PREVIOUS month as
  // its base when available, so consecutive months compound correctly.
  const byMonth = new Map(); // 'YYYY-MM' → {first, last}
  let prevMonthLast = null;  // last value of the previous month

  for (const point of tsSeries) {
    const d = new Date(point.ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!byMonth.has(key)) {
      // Base the month on the prior month's close when it exists
      byMonth.set(key, {
        first: prevMonthLast != null ? prevMonthLast : point.value,
        last: point.value,
      });
    } else {
      byMonth.get(key).last = point.value;
    }
    prevMonthLast = point.value;
  }

  const out = [];
  for (const [month, { first, last }] of byMonth) {
    if (first > 0) {
      out.push({ month, return: (last / first) - 1 });
    }
  }
  // Map preserves insertion order = chronological; sort defensively anyway.
  return out.sort((a, b) => (a.month < b.month ? -1 : 1));
}
