/**
 * factors.test.js — Unit tests for the crypto factor signal pipeline.
 *
 * Added in the 2026-08-29 audit ("Factor Monitor signal never changes from
 * WAIT"), which found five root causes:
 *   1. Quintile inversion — buildQuintilePortfolios sorted descending, so
 *      longOnly (Q5) held the LOWEST-scoring assets (losers, high-vol,
 *      illiquid) and shortOnly (Q1) the highest.
 *   2. Z-scores computed on a zero-crossing difference series — dividing a
 *      change in (longNorm − shortNorm) by its near-zero level filled the
 *      trailing baseline with ±400% artifacts, deflating every z below the
 *      |z| ≥ 2 stretch gate.
 *   3. Persistence gate read rotation.confirmed (only true right after a
 *      confirmed FLIP), so an established leader could never pass it.
 *   4. Crowding matrix built from a 4-day history → all-zero correlations.
 *   5. Stablecoins/gold/wrapped tokens in the universe (9 stables in the
 *      Low Volatility Q1).
 *
 * These tests pin the corrected behavior so none of them can silently
 * regress back to "always WAIT".
 *
 * Run with:  npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuintilePortfolios,
  computeSpreadMonitor,
  buildQuilt,
  computeLeadershipHistory,
} from '../../src/lib/scanner/factorEngine.js';
import { computeFactorStance, pickPrimarySignal } from '../../src/lib/factors/compositeEngine.js';
import { detectRotation } from '../../src/lib/factors/rotationDetector.js';
import { isExcludedAsset, filterTradableUniverse } from '../../src/lib/factors/universeFilter.js';
import { pairHorizonReturnWithStats, pairYtdReturn } from '../../src/lib/regime/regimePercentile.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a candle array from daily closes with real timestamps (ms). */
function candlesFromCloses(closes, endTs, vol = 0) {
  const n = closes.length;
  return closes.map((close, i) => ({
    ts: endTs - (n - 1 - i) * 86400000,
    open: close, high: close, low: close, close,
    vol,
  }));
}

/** Deterministic "noisy" price path: per-day return cycles through a
 *  7-element pattern (period doesn't divide 20, so overlapping 20d windows
 *  have real variance — needed for meaningful z-scores). */
function noisyCloses(n, basePattern, endTs, finalDrift = null, finalDays = 0) {
  const closes = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const drift = (finalDrift != null && i >= n - finalDays) ? finalDrift : basePattern[i % basePattern.length];
    price *= 1 + drift;
    closes.push(price);
  }
  return candlesFromCloses(closes, endTs);
}

const END_TS = Date.UTC(2026, 5, 30);  // fixed end so tests are deterministic

// ─── 1. Quintile construction ────────────────────────────────────────────────

describe('buildQuintilePortfolios', () => {
  const scored = Array.from({ length: 25 }, (_, i) => ({
    symbol: `A${String(i + 1).padStart(2, '0')}`,
    scores: { momentum: i + 1 },  // A01 lowest ... A25 highest
  }));

  test('longOnly (Q5) holds the HIGHEST-scoring assets, shortOnly (Q1) the lowest', () => {
    const { longOnly, shortOnly } = buildQuintilePortfolios(scored, 'momentum');
    // Regression (audit fix #1): the old descending sort put the TOP scores
    // in shortOnly — the whole table was sign-inverted.
    assert.deepEqual(shortOnly, ['A01', 'A02', 'A03', 'A04', 'A05']);
    assert.deepEqual(longOnly, ['A21', 'A22', 'A23', 'A24', 'A25']);
  });

  test('integer remainder lands in the TOP quintile (Q5)', () => {
    const scored27 = Array.from({ length: 27 }, (_, i) => ({
      symbol: `B${String(i + 1).padStart(2, '0')}`,
      scores: { momentum: i + 1 },
    }));
    const { quintiles, longOnly } = buildQuintilePortfolios(scored27, 'momentum');
    assert.equal(quintiles[0].length, 5);   // Q1 = floor(27/5) = 5
    assert.equal(quintiles[4].length, 7);   // Q5 = 5 + remainder 2
    assert.equal(longOnly.length, 7);
    assert.ok(longOnly.includes('B27'));    // highest scorer is in the long book
  });

  test('fewer than 10 scored assets → empty portfolios', () => {
    const tiny = Array.from({ length: 9 }, (_, i) => ({ symbol: `T${i}`, scores: { momentum: i } }));
    const p = buildQuintilePortfolios(tiny, 'momentum');
    assert.deepEqual(p.longOnly, []);
    assert.deepEqual(p.shortOnly, []);
  });
});

// ─── 2. Spread / rel pair returns ────────────────────────────────────────────

describe('computeSpreadMonitor (pair returns)', () => {
  // Long leg: quiet 7-day-cycle drift all year, then a 3%/day surge over
  // the final 20 days. Short leg: quiet drift all year. The 7-day cycle
  // gives the trailing 20d-window baseline real variance (a 5-day cycle
  // would divide 20 evenly and make every baseline window identical).
  const LONG_PATTERN = [0.010, -0.005, 0.008, -0.003, 0.006, -0.002, 0.004];
  const SHORT_PATTERN = [0.001, 0.000, 0.002, -0.001, 0.001, 0.000, 0.001];
  const longCandles = noisyCloses(300, LONG_PATTERN, END_TS, 0.03, 20);
  const shortCandles = noisyCloses(300, SHORT_PATTERN, END_TS);
  const candlesBySymbol = { LONG: longCandles, SHORT: shortCandles };
  const portfolios = {
    test: { quintiles: [], longOnly: ['LONG'], shortOnly: ['SHORT'], spread: ['LONG', 'SHORT'] },
  };

  const monitor = computeSpreadMonitor(portfolios, candlesBySymbol, ['LONG', 'SHORT']);
  const s20 = monitor.test.spread_20d;

  test('spread h-day return is the arithmetic pair return (longRet − shortRet)', () => {
    const L = longCandles, S = shortCandles;
    const expected = (L[299].close / L[279].close) - (S[299].close / S[279].close);
    assert.ok(Math.abs(s20.ret - expected) < 1e-9,
      `expected pair return ${expected}, got ${s20.ret}`);
    // The old difference-series formula produced ±300%+ artifacts; a correct
    // 20d pair return of an equal-weight 2-name book must stay modest.
    assert.ok(Math.abs(s20.ret) < 3, `spread 20d return suspiciously large: ${s20.ret}`);
  });

  test('rel h-day return is long minus BENCHMARK (not long-only)', () => {
    const r20 = monitor.test.rel_20d;
    // benchmark = equal-weight of LONG and SHORT (each normalized to 1.0 at
    // its own series start, so benchmark[i] = Lnorm[i]/... — compute it the
    // same way buildEqualWeightSeries does)
    const lNorm = (i) => longCandles[i].close / longCandles[0].close;
    const sNorm = (i) => shortCandles[i].close / shortCandles[0].close;
    const benchRet = (lNorm(299) + sNorm(299)) / (lNorm(279) + sNorm(279));
    const expected = lNorm(299) / lNorm(279) - benchRet;
    assert.ok(Math.abs(r20.ret - expected) < 1e-9,
      `expected rel ${expected}, got ${r20.ret}`);
  });

  test('a genuinely stretched 20d move produces |z| ≥ 2 (stretch gate can fire)', () => {
    // Regression (audit fix #2): the old z (vs a difference-series baseline
    // full of near-zero-division artifacts) deflated everything below ~1.3,
    // so the stretch gate never fired and every stance was WAIT.
    assert.ok(s20.z >= 2, `expected z >= 2 for the surge scenario, got ${s20.z}`);
    assert.ok(s20.pctile >= 95, `expected pctile >= 95, got ${s20.pctile}`);
  });

  test('all four horizons populated for both rel and spread', () => {
    for (const h of [1, 5, 20, 60]) {
      assert.ok(Number.isFinite(monitor.test[`rel_${h}d`]?.ret), `rel_${h}d missing`);
      assert.ok(Number.isFinite(monitor.test[`spread_${h}d`]?.ret), `spread_${h}d missing`);
    }
  });

  test('pairHorizonReturnWithStats: insufficient history → null', () => {
    assert.equal(pairHorizonReturnWithStats([1, 2, 3], [1, 2, 3], 20), null);
    assert.equal(pairHorizonReturnWithStats(null, [1], 1), null);
  });

  test('pairYtdReturn: arithmetic difference of the two legs', () => {
    // 400 daily candles ending 2026-06-30 → reaches back before Jan 1, 2026
    const a = noisyCloses(400, [0.001, 0.000, 0.002, -0.001, 0.001, 0.000, 0.001], END_TS);
    const b = noisyCloses(400, [0.0002, 0.0001, 0.0003, -0.0001, 0.0002, 0.0000, 0.0001], END_TS);
    const closesA = a.map(c => c.close), closesB = b.map(c => c.close);
    const daysSinceYearStart = Math.floor((END_TS - Date.UTC(2026, 0, 1)) / 86400000);
    const idx = 399 - daysSinceYearStart;
    const expected = (closesA[399] / closesA[idx]) - (closesB[399] / closesB[idx]);
    const got = pairYtdReturn(closesA, closesB, END_TS);
    assert.ok(got != null && Math.abs(got - expected) < 1e-9,
      `expected ytd ${expected}, got ${got}`);
    // Series that doesn't reach back to Jan 1 → null
    assert.equal(pairYtdReturn(closesA.slice(-100), closesB.slice(-100), END_TS), null);
  });
});

// ─── 3. Stance engine (persistence gate semantics) ───────────────────────────

describe('computeFactorStance (persistence gate)', () => {
  // An ESTABLISHED leader: leading 5 sessions, no flip in progress.
  // detectRotation() reports confirmed:false for this (confirmed is only
  // set right after a confirmed FLIP) — the stance engine must NOT depend
  // on that field for persistence.
  const established = {
    currentLabel: 'momentum', previousLabel: 'momentum',
    heldSessions: 5, flipped: false, flipFlag: false, confirmed: false,
    confirmSessions: 3, freshSessions: 10,
  };

  test('established leader + stretch + not crowded → CONSTRUCTIVE (was WAIT forever)', () => {
    const s = computeFactorStance({
      spreadZ: 2.5, spreadPctile: 98,
      rotation: established, crowdingScore: 0.3, factorName: 'momentum',
    });
    assert.equal(s.stance, 'CONSTRUCTIVE');
    assert.ok(s.confidence >= 7);
    assert.equal(s.gates.persistence, true);
    assert.ok(s.rationale.some(r => r.includes('Established leader')));
  });

  test('established leader, not stretched → SELECTIVE (maintain, not add)', () => {
    const s = computeFactorStance({
      spreadZ: 0.5, spreadPctile: 70,
      rotation: established, crowdingScore: 0.3, factorName: 'momentum',
    });
    assert.equal(s.stance, 'SELECTIVE');
    assert.equal(s.confidence, 5);
  });

  test('stretched but leadership only 2 sessions old → WAIT (unconfirmed)', () => {
    const s = computeFactorStance({
      spreadZ: 2.5, spreadPctile: 98,
      rotation: { ...established, heldSessions: 2, flipped: true },
      crowdingScore: 0.3, factorName: 'momentum',
    });
    assert.equal(s.stance, 'WAIT');
    assert.equal(s.gates.persistence, false);
  });

  test('negative stretch → DEFENSIVE regardless of persistence', () => {
    const s = computeFactorStance({
      spreadZ: -2.4, spreadPctile: 2,
      rotation: null, crowdingScore: 0.2, factorName: 'liquidity',
    });
    assert.equal(s.stance, 'DEFENSIVE');
    assert.equal(s.confidence, 6);
  });

  test('stretch + persistence but crowded → SELECTIVE (crowding caps conviction)', () => {
    const s = computeFactorStance({
      spreadZ: 2.5, spreadPctile: 98,
      rotation: established, crowdingScore: 0.9, factorName: 'momentum',
    });
    assert.equal(s.stance, 'SELECTIVE');
    assert.ok(s.confidence <= 5);
  });

  test('no rotation, no stretch → WAIT', () => {
    const s = computeFactorStance({ spreadZ: 0.2, spreadPctile: 55, factorName: 'size' });
    assert.equal(s.stance, 'WAIT');
    assert.equal(s.confidence, 2);
  });
});

// ─── 4. Primary signal selection ─────────────────────────────────────────────

describe('pickPrimarySignal', () => {
  test('highest confidence wins', () => {
    const stances = {
      momentum: { confidence: 5, raw: { spreadZ: 1 } },
      liquidity: { confidence: 6, raw: { spreadZ: -0.5 } },
    };
    assert.equal(pickPrimarySignal(stances).factorName, 'liquidity');
  });

  test('confidence tie broken by |spreadZ| (not insertion order)', () => {
    const stances = {
      momentum: { confidence: 5, raw: { spreadZ: -1.2 } },
      liquidity: { confidence: 5, raw: { spreadZ: 3.1 } },
    };
    assert.equal(pickPrimarySignal(stances).factorName, 'liquidity');
  });

  test('empty input → null', () => {
    assert.equal(pickPrimarySignal({}), null);
    assert.equal(pickPrimarySignal(null), null);
  });
});

// ─── 5. detectRotation flip semantics (regression guard — unchanged) ─────────

describe('detectRotation (flip semantics unchanged)', () => {
  test('confirmed flip requires 3 sessions for both old and new leader', () => {
    const history = [
      { date: '2026-08-01', leader: 'momentum' },
      { date: '2026-08-02', leader: 'momentum' },
      { date: '2026-08-03', leader: 'momentum' },
      { date: '2026-08-04', leader: 'volatility' },
      { date: '2026-08-05', leader: 'volatility' },
      { date: '2026-08-06', leader: 'volatility' },
    ];
    const r = detectRotation(history);
    assert.equal(r.currentLabel, 'volatility');
    assert.equal(r.heldSessions, 3);
    assert.equal(r.flipped, true);
    assert.equal(r.confirmed, true);
    assert.equal(r.flipFlag, true);
  });

  test('stable leadership: flipped=false, heldSessions counts the run', () => {
    const r = detectRotation([
      { date: '2026-08-01', leader: 'volatility' },
      { date: '2026-08-02', leader: 'volatility' },
      { date: '2026-08-03', leader: 'volatility' },
      { date: '2026-08-04', leader: 'volatility' },
    ]);
    assert.equal(r.currentLabel, 'volatility');
    assert.equal(r.heldSessions, 4);
    assert.equal(r.flipped, false);
    // detectRotation's `confirmed` stays false here BY DESIGN (it flags
    // confirmed flips) — the stance engine now uses heldSessions instead.
    assert.equal(r.confirmed, false);
  });

  test('short history → empty state', () => {
    const r = detectRotation([{ date: '2026-08-01', leader: 'x' }]);
    assert.equal(r.currentLabel, null);
    assert.equal(r.heldSessions, 0);
  });
});

// ─── 6. Universe filter ──────────────────────────────────────────────────────

describe('universeFilter', () => {
  test('excludes stablecoins, gold, wrapped/LST, exchange tokens by symbol', () => {
    for (const sym of ['USDT', 'USDC', 'DAI', 'USDE', 'USD1', 'PYUSD', 'XAUT', 'PAXG', 'WBTC', 'WSTETH', 'LEO', 'OKB', 'BGB']) {
      assert.equal(isExcludedAsset({ symbol: sym }), true, `${sym} should be excluded`);
    }
  });

  test('keeps genuine tokens', () => {
    for (const sym of ['BTC', 'ETH', 'SOL', 'BNB', 'TRX', 'DOGE', 'LINK']) {
      assert.equal(isExcludedAsset({ symbol: sym }), false, `${sym} should be kept`);
    }
  });

  test('excludes by CMC tags (server path)', () => {
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', tags: ['stablecoin'] }), true);
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', tags: ['tokenized-gold'] }), true);
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', tags: ['wrapped-tokens'] }), true);
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', tags: ['layer-1'] }), false);
  });

  test('excludes by name pattern (client CoinGecko path has no tags)', () => {
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', name: 'Wrapped Bitcoin' }), true);
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', name: 'Some USD Coin' }), true);
    assert.equal(isExcludedAsset({ symbol: 'ZZZ', name: 'PAX Gold' }), true);
    // must NOT match legitimate names
    assert.equal(isExcludedAsset({ symbol: 'BTC', name: 'Bitcoin' }), false);
    assert.equal(isExcludedAsset({ symbol: 'ETH', name: 'Ethereum' }), false);
    assert.equal(isExcludedAsset({ symbol: 'ZK', name: 'ZKsync' }), false);
  });

  test('filterTradableUniverse preserves order and drops pegged', () => {
    const out = filterTradableUniverse([
      { symbol: 'USDT', name: 'Tether' },
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'XAUT', name: 'Tether Gold' },
      { symbol: 'ETH', name: 'Ethereum' },
    ]);
    assert.deepEqual(out.map(c => c.symbol), ['BTC', 'ETH']);
  });
});

// ─── 8. Leadership history backfill ──────────────────────────────────────────

describe('computeLeadershipHistory (rotation backfill)', () => {
  // Factor WIN's long book compounds +1%/day; factor LOSE's long book is
  // flat. Over any trailing 20d window WIN outperforms → WIN leads every day.
  const winCloses = [];
  let wp = 100;
  for (let i = 0; i < 120; i++) { wp *= 1.01; winCloses.push(wp); }
  const loseCloses = new Array(120).fill(100);

  const candlesBySymbol = {
    WIN: candlesFromCloses(winCloses, END_TS),
    LOSE: candlesFromCloses(loseCloses, END_TS),
  };
  const portfolios = {
    win: { quintiles: [], longOnly: ['WIN'], shortOnly: [], spread: [] },
    lose: { quintiles: [], longOnly: ['LOSE'], shortOnly: [], spread: [] },
  };

  test('reconstructs a dated {date, leader} series, oldest first', () => {
    const hist = computeLeadershipHistory(portfolios, candlesBySymbol, 30);
    assert.equal(hist.length, 30);
    // oldest first
    assert.ok(hist[0].date < hist[hist.length - 1].date);
    // last entry is dated from the final candle timestamp
    assert.equal(hist[hist.length - 1].date, new Date(END_TS).toISOString().slice(0, 10));
    // WIN leads every session (its 20d return dominates)
    assert.ok(hist.every(h => h.leader === 'win'));
    // entries shaped for detectRotation
    for (const h of hist) {
      assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof h.leader, 'string');
    }
  });

  test('leadership flips when the outperformer flips', () => {
    // LOSE pumps +3%/day for the final 25 days → it should lead the trailing
    // sessions once its 20d return overtakes WIN's (~7 pump days needed)
    const loseCloses2 = [];
    let lp = 100;
    for (let i = 0; i < 120; i++) {
      lp *= (i >= 95) ? 1.03 : 1.0;
      loseCloses2.push(lp);
    }
    const cbs = {
      WIN: candlesFromCloses(winCloses, END_TS),
      LOSE: candlesFromCloses(loseCloses2, END_TS),
    };
    const hist = computeLeadershipHistory(portfolios, cbs, 30);
    const lastFew = hist.slice(-15);
    assert.ok(lastFew.every(h => h.leader === 'lose'),
      'expected LOSE to lead the final sessions');
    // and WIN still led before the pump
    assert.equal(hist[0].leader, 'win');
  });

  test('insufficient history → empty array', () => {
    const short = { a: { quintiles: [], longOnly: ['WIN'], shortOnly: [], spread: [] } };
    const shortCandles = { WIN: candlesFromCloses(winCloses.slice(-15), END_TS) };
    assert.deepEqual(computeLeadershipHistory(short, shortCandles, 30), []);
  });

  test('feeds detectRotation: backfilled flip gets confirmed (and is fresh)', () => {
    // Pump starts 12 sessions from the end: LOSE's 20d return overtakes
    // WIN's ~6 sessions from the end → heldSessions lands INSIDE the
    // 3..10 fresh window, so both confirmed and flipFlag are true.
    const loseCloses2 = [];
    let lp = 100;
    for (let i = 0; i < 120; i++) {
      lp *= (i >= 108) ? 1.03 : 1.0;
      loseCloses2.push(lp);
    }
    const cbs = {
      WIN: candlesFromCloses(winCloses, END_TS),
      LOSE: candlesFromCloses(loseCloses2, END_TS),
    };
    const hist = computeLeadershipHistory(portfolios, cbs, 30);
    const r = detectRotation(hist);
    assert.equal(r.currentLabel, 'lose');
    assert.equal(r.previousLabel, 'win');
    assert.ok(r.heldSessions >= 3 && r.heldSessions <= 10,
      `heldSessions ${r.heldSessions} outside fresh window`);
    assert.equal(r.confirmed, true);
    assert.equal(r.flipFlag, true);
  });
});

// ─── 7. Quilt month alignment ────────────────────────────────────────────────

describe('buildQuilt (calendar-month alignment)', () => {
  // Two factors with DIFFERENT history lengths — the old index-based month
  // bucketing labeled their months differently, so cross-factor month
  // matching failed and the quilt showed mostly 0.0%.
  // Factor ONE: 300 days ending 2026-06-30. Factor TWO: 200 days.
  // Both rise exactly 1%/day through June 2026 and are flat otherwise.
  function juneRampCandles(n) {
    const closes = [];
    let price = 100;
    const startTs = END_TS - (n - 1) * 86400000;
    for (let i = 0; i < n; i++) {
      const ts = startTs + i * 86400000;
      const d = new Date(ts);
      const inJune = d.getUTCFullYear() === 2026 && d.getUTCMonth() === 5;
      if (inJune) price *= 1.01;
      closes.push(price);
    }
    return candlesFromCloses(closes, END_TS);
  }

  const candlesBySymbol = {
    ONE: juneRampCandles(300),
    TWO: juneRampCandles(200),
  };
  const portfolios = {
    alpha: { quintiles: [], longOnly: ['ONE'], shortOnly: [], spread: ['ONE'] },
    beta: { quintiles: [], longOnly: ['TWO'], shortOnly: [], spread: ['TWO'] },
  };

  const quilt = buildQuilt(portfolios, candlesBySymbol);

  test('months are real calendar months shared by all factors', () => {
    assert.ok(quilt.length >= 5);
    for (const { month } of quilt) {
      assert.match(month, /^\d{4}-(0[1-9]|1[0-2])$/, `bad month label ${month}`);
    }
    // June 2026 must exist for BOTH factors (the old code mislabeled one
    // of them and rendered a false 0.0% or missing cell).
    const june = quilt.find(q => q.month === '2026-06');
    assert.ok(june, '2026-06 missing from quilt');
    const names = june.ranking.map(r => r.factor);
    assert.ok(names.includes('alpha') && names.includes('beta'));
  });

  test('a known +1%/day month yields the compounded June return', () => {
    const june = quilt.find(q => q.month === '2026-06');
    const alpha = june.ranking.find(r => r.factor === 'alpha');
    // 30 trading days at 1%: 1.01^30 − 1 ≈ 0.3478 (May is flat → base ≈ 1.0)
    assert.ok(alpha.return != null);
    assert.ok(Math.abs(alpha.return - (Math.pow(1.01, 30) - 1)) < 0.02,
      `June return ${alpha.return} ≠ ~${(Math.pow(1.01, 30) - 1).toFixed(4)}`);
  });

  test('factors missing a month get null (renders "—"), not a false 0', () => {
    // 300-day factor reaches into Sep 2025; the 200-day factor doesn't.
    const earlyMonth = quilt.find(q => q.month === '2025-09' || q.month === '2025-10');
    if (earlyMonth) {
      const two = earlyMonth.ranking.find(r => r.factor === 'beta');
      if (two) {
        // beta starts ~2025-12-12, so any month before that must be null
        assert.equal(two.return, null);
      }
    }
  });
});
