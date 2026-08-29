/**
 * Regime Percentile — extends z-scores with rolling-window percentiles.
 *
 * Why percentiles?
 *   Z-scores assume normality. Financial returns are fat-tailed — a z=2.0 in a
 *   calm regime (low vol) is much rarer than z=2.0 in a volatile regime.
 *   Percentiles are non-parametric: "current value exceeds 98% of historical
 *   observations" is true regardless of distribution shape.
 *
 * Borrowed from factorwatch.ai's spread_monitor methodology:
 *   "Report z-score and percentile (returns are fat-tailed; the percentile
 *    keeps the z honest)."
 *   — https://factorwatch.ai/methodology.html §5
 *
 * Usage:
 *   const { z, pctile } = adaptiveZWithPctile(btcPriceSeries, 90, 365);
 *   // z = 1.8σ, pctile = 96.4 → "above 96.4% of historical 90d windows"
 */

import { adaptiveZ, mean, stddev } from './regimeCalculations.js';

/**
 * Compute adaptive z-score AND its percentile against trailing overlapping windows.
 *
 * For each of the trailing N windows of length `shortLen`, compute what the
 * adaptive z-score would have been at that point. Then count what fraction of
 * those historical z-scores are below the current z.
 *
 * @param {number[]} series - values, oldest first
 * @param {number} shortLen - short lookback window (e.g. 90 for daily)
 * @param {number} longLen - long lookback window (e.g. 365 for daily)
 * @param {number} [lookback=252] - how many historical windows to compare against (~1 trading year)
 * @returns {{z: number, pctile: number}} - z-score and percentile (0-100)
 */
export function adaptiveZWithPctile(series, shortLen = 90, longLen = 365, lookback = 252) {
  if (!series || series.length < shortLen + lookback) {
    return { z: adaptiveZ(series, shortLen, longLen), pctile: 50 };
  }

  // Current z
  const currentZ = adaptiveZ(series, shortLen, longLen);

  // Build baseline of historical z-scores from trailing windows
  const baseline = [];
  // Walk back through history; for each anchor point, compute what adaptiveZ would have been
  for (let i = series.length - lookback; i < series.length - 1; i++) {
    if (i < longLen) continue;  // not enough history
    const sliceUpTo = series.slice(0, i + 1);
    if (sliceUpTo.length < longLen) continue;
    const historicalZ = adaptiveZ(sliceUpTo, shortLen, longLen);
    if (Number.isFinite(historicalZ)) baseline.push(historicalZ);
  }

  if (baseline.length === 0) {
    return { z: currentZ, pctile: 50 };
  }

  // Percentile: what fraction of baseline is below currentZ
  const below = baseline.filter(b => b < currentZ).length;
  const pctile = (below / baseline.length) * 100;

  return { z: currentZ, pctile };
}

/**
 * Simple percentile of a value against an array of historical values.
 * Used for non-z-score series (e.g. "current return vs trailing 252 daily returns").
 *
 * @param {number} current - the value to rank
 * @param {number[]} history - array of historical values
 * @returns {number} percentile 0-100 (50 = median)
 */
export function percentileOf(current, history) {
  if (!history || history.length === 0) return 50;
  const below = history.filter(h => h < current).length;
  return (below / history.length) * 100;
}

/**
 * Compute h-day compounded return for a price series.
 * Used by factorwatch-style spread monitors (1d, 5d, 20d, 60d horizons).
 *
 * @param {number[]} prices - oldest first
 * @param {number} horizonDays - 1, 5, 20, 60
 * @returns {number|null} - decimal return (0.05 = +5%) or null if insufficient data
 */
export function horizonReturn(prices, horizonDays) {
  if (!prices || prices.length < horizonDays + 1) return null;
  const end = prices[prices.length - 1];
  const start = prices[prices.length - 1 - horizonDays];
  if (!start || !end) return null;
  return (end - start) / start;
}

/**
 * Compute h-day return AND its z-score + percentile vs trailing 252 overlapping windows.
 * Mirrors factorwatch's spread_monitor calculation exactly.
 *
 * @returns {{ret: number, z: number, pctile: number}|null}
 */
export function horizonReturnWithStats(prices, horizonDays, lookback = 252) {
  if (!prices || prices.length < horizonDays + 1) return null;

  const currentRet = Math.max(-0.95, Math.min(10.0, horizonReturn(prices, horizonDays)));
  if (currentRet == null) return null;

  // Build baseline of overlapping h-day returns
  const baseline = [];
  for (let i = prices.length - 1; i >= horizonDays; i--) {
    const end = prices[i];
    const start = prices[i - horizonDays];
    if (start && end) baseline.push((end - start) / start);
    if (baseline.length >= lookback) break;
  }

  if (baseline.length < 10) {
    return { ret: currentRet, z: 0, pctile: 50 };
  }

  const mu = mean(baseline);
  const sd = stddev(baseline, mu) || 1;
  const z = (currentRet - mu) / sd;
  const pctile = percentileOf(currentRet, baseline);

  return { ret: currentRet, z, pctile };
}

/**
 * Compute the h-day return of a LONG-SHORT (or long-benchmark) pair and its
 * z-score + percentile vs trailing overlapping windows.
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): the previous approach
 * applied horizonReturnWithStats() to a *difference* series
 * (longNorm − shortNorm), which starts at 0 and crosses zero. Dividing a
 * change in that series by its near-zero level produced ±400%+ artifacts in
 * the baseline (14% of one factor's baseline windows exceeded |300%|),
 * inflating the trailing stdev and crushing every z-score below ~1.3 — so
 * the |z| ≥ 2 stretch gate could essentially never fire and every factor
 * stance resolved to WAIT.
 *
 * Correct definition: the h-day return of a long-short pair is the
 * arithmetic return difference of the two legs:
 *     pairRet_h(t) = A[t]/A[t−h] − B[t]/B[t−h]
 * This is scale-free, never divides by a difference, and matches how the
 * crowding matrix (extractSpreadSeries) already computes daily spread
 * returns — the two definitions now agree.
 *
 * @param {number[]} seriesA - long leg price series (positive values, oldest first)
 * @param {number[]} seriesB - short/benchmark leg price series (positive values)
 * @param {number} horizonDays - 1, 5, 20, 60
 * @param {number} [lookback=252] - how many overlapping windows to compare against
 * @returns {{ret: number, z: number, pctile: number}|null}
 */
export function pairHorizonReturnWithStats(seriesA, seriesB, horizonDays, lookback = 252) {
  if (!seriesA || !seriesB) return null;

  // Align the two legs to the trailing minLen points (most recent dates),
  // same alignment subtractSeries() used.
  const minLen = Math.min(seriesA.length, seriesB.length);
  if (minLen < horizonDays + 1) return null;
  const a = seriesA.slice(seriesA.length - minLen);
  const b = seriesB.slice(seriesB.length - minLen);

  // Build the series of h-day pair returns, newest first.
  const values = [];
  for (let i = minLen - 1; i >= horizonDays; i--) {
    const aPrev = a[i - horizonDays], bPrev = b[i - horizonDays];
    if (!aPrev || !bPrev) continue;
    values.push((a[i] / aPrev) - (b[i] / bPrev));
    if (values.length >= lookback + 1) break;
  }

  if (values.length < 1) return null;

  const current = values[0];          // newest window
  const baseline = values.slice(1);   // historical windows

  if (baseline.length < 10) {
    return { ret: current, z: 0, pctile: 50 };
  }

  const mu = mean(baseline);
  const sd = stddev(baseline, mu) || 1;
  const z = (current - mu) / sd;
  const pctile = percentileOf(current, baseline);

  return { ret: current, z, pctile };
}

/**
 * Year-to-date return for a long-short (or long-benchmark) pair.
 * Uses the same arithmetic-difference definition as pairHorizonReturnWithStats:
 *     pairYtd = A[end]/A[ytdStart] − B[end]/B[ytdStart]
 *
 * @param {number[]} seriesA - long leg (positive values, oldest first)
 * @param {number[]} seriesB - short/benchmark leg
 * @param {number} [endTs=Date.now()] - timestamp of the series' last point
 *   (defaults to now; pass explicitly when testing historical series)
 * @returns {number|null} YTD pair return, or null if either leg doesn't reach
 *   back to the start of the year.
 */
export function pairYtdReturn(seriesA, seriesB, endTs = Date.now()) {
  if (!seriesA || !seriesB) return null;
  const minLen = Math.min(seriesA.length, seriesB.length);
  if (minLen === 0) return null;
  const a = seriesA.slice(seriesA.length - minLen);
  const b = seriesB.slice(seriesB.length - minLen);

  const currentYear = new Date(endTs).getFullYear();
  const yearStart = Date.UTC(currentYear, 0, 1);
  const daysSinceYearStart = Math.floor((endTs - yearStart) / 86400000);
  // Need data from before Jan 1 on BOTH legs (5-day buffer)
  if (minLen <= daysSinceYearStart + 5) return null;
  const ytdStartIdx = minLen - 1 - daysSinceYearStart;

  const aStart = a[ytdStartIdx], bStart = b[ytdStartIdx];
  if (!aStart || !bStart || !a[minLen - 1] || !b[minLen - 1]) return null;
  return (a[minLen - 1] / aStart) - (b[minLen - 1] / bStart);
}
