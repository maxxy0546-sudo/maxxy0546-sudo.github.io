/**
 * Crypto Factor Computation — server-side factor engine for build_snapshot.js
 *
 * Ports the client-side factorEngine.js to Node.js so crypto factor data
 * can be computed server-side and persisted in the snapshot. This enables:
 *
 *   1. Server-side rotation history (crypto_factor_history in snapshot.json)
 *   2. Server-side crowding history (spread series in snapshot)
 *   3. Instant first paint for the Factor Monitor (no client-side fetch needed)
 *   4. Shared state across all visitors (not per-browser localStorage)
 *
 * Data flow:
 *   1. Fetch top 100 crypto by market cap from CoinGecko (already in build_snapshot)
 *   2. Fetch 1 year of daily candles from exchange APIs (server-side, no CORS)
 *   3. Run factorEngine.js: computeFactorScores → buildQuintilePortfolios →
 *      computeSpreadMonitor → detectFactorRotation
 *   4. Store the current leader + spread data in snapshot.json
 *   5. Append today's leader to crypto_factor_history (capped at 90 entries)
 *
 * The client FactorMonitor reads from the snapshot for instant first paint,
 * then optionally live-refreshes for fresh data.
 */

import { computeFactorScores, buildQuintilePortfolios, computeSpreadMonitor, detectFactorRotation, buildQuilt, computeLeadershipHistory } from '../src/lib/scanner/factorEngine.js';
import { detectRotation, appendToHistory } from '../src/lib/factors/rotationDetector.js';
import { buildCrowdingMatrix, extractSpreadSeries } from '../src/lib/factors/crowdingMatrix.js';
// F-14-b-6 + F-14-b-17 (2026-08-26): import the canonical computeFactorStance
// from compositeEngine.js. Previously this file shipped a local
// `computeStanceFromSpread` that mirrored computeFactorStance but drifted
// (missing parameters: spreadPctile, confirmation, factorName). Worse, the
// client (FactorMonitor.jsx) recomputed stances client-side and discarded
// the server's values — two implementations guaranteed to diverge. Now both
// server and client use the same function, eliminating drift.
import { computeFactorStance } from '../src/lib/factors/compositeEngine.js';
import { filterTradableUniverse } from '../src/lib/factors/universeFilter.js';
import { fetchWithTimeout } from '../src/lib/scanner/fetchWithTimeout.js';

const FACTORS = ['momentum', 'size', 'volatility', 'beta', 'liquidity'];

// ── Exchange request pacing + retry (2026-08-29, "Factor Monitor always
// WAIT" follow-up: CI universe degradation) ─────────────────────────────────
//
// Symptom: snapshots built on GitHub Actions runners (Azure US IPs)
// consistently landed a 46-63 asset universe out of ~94 fetchable assets,
// while the same code from a clean network fetches 94/100. Diagnosis:
// OKX/Bybit rate-limit (HTTP 429) the bursty request pattern — up to 10
// concurrent symbols × 1-4 sequential requests each with zero inter-request
// pacing (F-14-b-18 removed the 500ms pause on the assumption that "exchange
// APIs handle 10 concurrent requests without rate-limit issues" — a probe
// on 2026-08-29 caught live 429s from OKX even on a clean network at that
// concurrency). Each 429 surfaces as `!res.ok` → empty candle array → the
// asset is SILENTLY dropped by the `candles.length < 60` gate, so 35% of
// the universe vanished with no log line. A smaller, fluctuating universe
// destabilizes the quintile spreads between builds and weakens every factor
// signal derived from them.
//
// Fix (this block):
//   1. PACE every OKX/Bybit request globally ≥125ms apart (~8 req/s — under
//      OKX's 20-requests-per-2s public limit) regardless of symbol-loop
//      concurrency.
//   2. RETRY 429/5xx/transport failures up to 3 attempts with backoff
//      (honoring Retry-After when sane). Other 4xx are deterministic
//      ("symbol not listed") and not retried.
//   3. Log dropped symbols so the loss is visible in CI logs (below, in
//      computeCryptoFactors step 2).
// Cost: ~20-30s per snapshot build vs the un-paced burst. Universe
// completeness is worth far more than build seconds — a 12-per-quintile
// universe (60 assets) has materially noisier spreads than 19-per-quintile
// (94 assets).

const PACE_MS = 125;
let _lastReqAt = 0;
let _paceChain = Promise.resolve();

/** Serialize request STARTS at least PACE_MS apart (global, module-level). */
function _pacedStart() {
  const run = async () => {
    const wait = Math.max(0, _lastReqAt + PACE_MS - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _lastReqAt = Date.now();
  };
  // Re-assign the chain so later callers queue behind this slot; errors in
  // the pacer itself must never break the queue.
  _paceChain = _paceChain.then(run, run);
  return _paceChain;
}

/**
 * Fetch an exchange endpoint with global pacing + retry on transient errors.
 * @returns {Promise<Response|null>} Response, or null when every attempt
 *   failed on a transient condition (429/5xx/timeout/network).
 */
async function fetchExchange(url, timeoutMs = 10000) {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await _pacedStart();
    try {
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'TrendScan-Snapshot/1.0' },
      }, timeoutMs);
      if (res.status === 429 || res.status >= 500) {
        if (attempt === MAX_ATTEMPTS) return res;  // let caller's !ok path handle it
        const retryAfterSec = parseInt(res.headers.get('retry-after') || '', 10);
        const backoff = Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 5
          ? retryAfterSec * 1000
          : 700 * attempt;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch {
      // Timeout or network error — transient, worth one more paced attempt.
      if (attempt === MAX_ATTEMPTS) return null;
      await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  return null;
}

/**
 * Fetch top 100 crypto by market cap.
 * Primary: CMC crypto_universe (already fetched by build_snapshot.js, no extra API call).
 * Fallback: CoinGecko /coins/markets (may be rate-limited).
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): both paths now run
 * filterTradableUniverse() to strip USD stablecoins, tokenized gold,
 * wrapped/staked derivatives, and exchange revenue tokens before the
 * universe is built. 12 pegged/native assets had been landing in the
 * quintile portfolios — e.g. 9 stablecoins sat in the Low Volatility Q1,
 * turning that factor into "alts vs stables" instead of a volatility bet.
 * See src/lib/factors/universeFilter.js for the exclusion criteria.
 *
 * @param {object} cryptoUniverse - The snapshot's crypto_universe object (from CMC).
 *   If provided, uses it instead of making a separate API call.
 */
async function fetchTopCryptoByMcap(limit = 100, cryptoUniverse = null) {
  // Primary: use CMC crypto_universe if provided (no extra API call).
  // CMC entries carry `name` + `tags`, so both the tag-based and name-based
  // exclusion layers in filterTradableUniverse are active on this path.
  if (cryptoUniverse && typeof cryptoUniverse === 'object') {
    const coins = filterTradableUniverse(
      Object.values(cryptoUniverse)
        .filter(c => c && c.symbol && c.marketCap > 0)
        .sort((a, b) => (a.marketCapRank || 999) - (b.marketCapRank || 999))
        .slice(0, limit + 25)  // over-fetch: filter removes ~10-15% of top-100
    ).slice(0, limit)
      .map(c => ({
        symbol: c.symbol.toUpperCase(),
        marketCap: c.marketCap || 0,
        volume24h: c.volume24h || 0,
      }));
    if (coins.length >= 50) {
      console.log(`  ✓ CMC crypto_universe: ${coins.length} tradable coins after pegged-asset filter (no extra API call)`);
      return coins;
    }
    console.log(`  ⚠ CMC crypto_universe only ${coins.length} tradable coins, trying CoinGecko`);
  }

  // Fallback: CoinGecko /coins/markets (keeps `name` so the name-based
  // exclusion layer stays active on this path too)
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=' + (limit + 25) + '&page=1&sparkline=false';
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'TrendScan-Snapshot/1.0' },
    }, 15000);
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return filterTradableUniverse(arr.map(c => ({
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name || '',
      marketCap: c.market_cap || 0,
      volume24h: c.total_volume || 0,
    })))
      .filter(c => c.symbol && c.marketCap > 0)
      .slice(0, limit)
      .map(c => ({ symbol: c.symbol, marketCap: c.marketCap, volume24h: c.volume24h }));
  } catch {
    return [];
  }
}

/**
 * Fetch daily candles for a crypto symbol from OKX (server-side, no CORS).
 * Falls back to Bybit if OKX doesn't list the symbol.
 */
async function fetchCryptoCandles(symbol, limit = 365) {
  // F-14-b-11 (2026-08-26): Paginate OKX + Bybit fetches to ensure we get
  // ≥252 candles for the 252-day momentum window. Previously OKX capped at
  // 300 (sufficient) but Bybit capped at 200 (insufficient — fell through to
  // the buggy 30-251 day momentum fallback in factorEngine.js). Now we
  // paginate Bybit with 2 calls (200 + (limit-200)) when limit > 200.
  // OKX supports up to 300 per call; if limit > 300 we paginate OKX too.
  const okxFetch = async (instId, maxBars) => {
    const url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1D&limit=${Math.min(maxBars, 300)}`;
    const res = await fetchExchange(url);
    if (!res || !res.ok) return [];
    const d = await res.json();
    if (d.code !== '0' || !d.data?.length) return [];
    return d.data.reverse().map(k => ({
      ts: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      vol: parseFloat(k[5]),
    })).filter(c => c.close > 0);
  };

  const bybitFetch = async (sym, maxBars) => {
    const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}USDT&interval=D&limit=${Math.min(maxBars, 200)}`;
    const res = await fetchExchange(url);
    if (!res || !res.ok) return [];
    const d = await res.json();
    if (d.retCode !== 0 || !d.result?.list?.length) return [];
    return d.result.list.reverse().map(k => ({
      ts: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      vol: parseFloat(k[5]),
    })).filter(c => c.close > 0);
  };

  // Merge two candle arrays (oldest-first), deduping by ts.
  const mergeCandles = (a, b) => {
    const seen = new Map();
    for (const c of [...a, ...b]) {
      if (!seen.has(c.ts)) seen.set(c.ts, c);
    }
    return Array.from(seen.values()).sort((x, y) => x.ts - y.ts);
  };

  // Try OKX SWAP (perps) first, paginating if needed
  let candles = await okxFetch(`${symbol}-USDT-SWAP`, limit);
  if (candles.length >= 30 && candles.length < limit) {
    // Paginate: fetch older candles using the oldest ts as the 'before' cursor
    const before = candles[0]?.ts ? new Date(candles[0].ts).toISOString() : undefined;
    if (before) {
      const url = `https://www.okx.com/api/v5/market/history-candles?instId=${symbol}-USDT-SWAP&bar=1D&limit=${Math.min(limit - candles.length, 300)}&before=${before}`;
      try {
        const res = await fetchExchange(url);
        if (res && res.ok) {
          const d = await res.json();
          if (d.code === '0' && d.data?.length) {
            const older = d.data.reverse().map(k => ({
              ts: parseInt(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]),
              low: parseFloat(k[3]), close: parseFloat(k[4]), vol: parseFloat(k[5]),
            })).filter(c => c.close > 0);
            candles = mergeCandles(older, candles);
          }
        }
      } catch {}
    }
  }
  if (candles.length >= 30) return candles;

  // Fall back to OKX SPOT
  candles = await okxFetch(`${symbol}-USDT`, limit);
  if (candles.length >= 30) return candles;

  // Fall back to Bybit — paginate to exceed 200-cap when limit > 200
  candles = await bybitFetch(symbol, Math.min(limit, 200));
  if (candles.length > 0 && limit > 200 && candles.length < limit) {
    // Bybit v5 supports `end` cursor (timestamp in ms). Fetch the next batch
    // ending just before the oldest candle we already have.
    const end = candles[0]?.ts ? candles[0].ts - 1 : undefined;
    if (end) {
      const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}USDT&interval=D&limit=${Math.min(limit - candles.length, 200)}&end=${end}`;
      try {
        const res = await fetchExchange(url);
        if (res && res.ok) {
          const d = await res.json();
          if (d.retCode === 0 && d.result?.list?.length) {
            const older = d.result.list.reverse().map(k => ({
              ts: parseInt(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]),
              low: parseFloat(k[3]), close: parseFloat(k[4]), vol: parseFloat(k[5]),
            })).filter(c => c.close > 0);
            candles = mergeCandles(older, candles);
          }
        }
      } catch {}
    }
  }
  if (candles.length >= 30) return candles;

  return [];
}

/**
 * Compute crypto factors server-side.
 *
 * @param {object} prevSnapshot - previous snapshot (for history accumulation)
 * @returns {Promise<object|null>} factor data or null on failure
 */
export async function computeCryptoFactors(prevSnapshot, cryptoUniverse = null) {
  console.log('  Computing crypto factors...');

  // 1. Fetch top 100 by market cap — pass cryptoUniverse from CMC snapshot
  const topCoins = await fetchTopCryptoByMcap(100, cryptoUniverse || prevSnapshot?.crypto_universe);
  if (topCoins.length < 20) {
    console.warn('  ⚠ Crypto factors: not enough market data');
    return null;
  }

  // 2. Fetch candles (batched; the global pacer in fetchExchange bounds the
  // request rate, so batchSize only controls how many symbol pipelines are
  // in flight — not the requests-per-second the exchanges see).
  // F-14-b-18 (2026-08-26) removed the inter-batch 500ms pause and bumped
  // batchSize 5→10 (~10s saved per build). Revisit (2026-08-29): un-paced
  // bursts tripped OKX/Bybit rate limits on CI runners, silently dropping
  // ~35% of the universe (46-63 of ~94 fetchable assets per build). The
  // paced + retried fetchExchange above is the real fix; batchSize is back
  // at 5 to keep each wave's timeout/fallback fan-out small.
  const batchSize = 5;
  const universe = [];
  const dropped = [];

  for (let i = 0; i < topCoins.length; i += batchSize) {
    const batch = topCoins.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async coin => {
        const candles = await fetchCryptoCandles(coin.symbol, 365);
        if (!candles || candles.length < 60) {
          dropped.push(coin.symbol);
          return null;
        }
        return {
          symbol: coin.symbol,
          candles,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
        };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        // Inject 24h volume into last candle if vol=0
        if (r.value.volume24h > 0 && r.value.candles.length > 0) {
          const lastCandle = r.value.candles[r.value.candles.length - 1];
          if (lastCandle.vol === 0) {
            lastCandle.vol = r.value.volume24h / (lastCandle.close || 1);
          }
        }
        universe.push(r.value);
      }
    }
    // No pause between batches — Promise.allSettled already throttles
  }

  // Visibility: after retries, remaining drops are genuine gaps (no USDT
  // listing on OKX/Bybit, or <60d of history) — but they belong in the CI
  // log, not in silent universe shrinkage. Cluster-size sanity follows:
  // a healthy build drops ~5-8 of the filtered top-100; double digits mean
  // something upstream changed.
  if (dropped.length > 0) {
    console.log(`  ⚠ ${dropped.length} assets dropped (no OKX/Bybit USDT listing or <60d history): ${dropped.join(', ')}`);
  }

  if (universe.length < 20) {
    console.warn(`  ⚠ Crypto factors: only ${universe.length} assets with sufficient candle data`);
    return null;
  }

  // 3. Compute factor scores
  const scored = computeFactorScores(universe);
  if (scored.length === 0) {
    console.warn('  ⚠ Crypto factors: scoring failed');
    return null;
  }

  // 4. Build quintile portfolios
  const portfoliosByFactor = {};
  for (const factor of FACTORS) {
    portfoliosByFactor[factor] = buildQuintilePortfolios(scored, factor);
  }

  // 5. Build candles-by-symbol map
  const candlesBySymbol = {};
  for (const u of universe) candlesBySymbol[u.symbol] = u.candles;

  // 6. Compute spread monitor
  const benchmarkSymbols = universe.map(u => u.symbol);
  const spreadMonitor = computeSpreadMonitor(portfoliosByFactor, candlesBySymbol, benchmarkSymbols);

  // 7. Compute rotation (snapshot-based)
  const rotation = detectFactorRotation(portfoliosByFactor, candlesBySymbol);
  const today = new Date().toISOString().slice(0, 10);

  // 8. Accumulate factor leadership history.
  //
  // (a) One-time purge: leader entries recorded before 2026-08-29 were
  //     computed by the quintile-inverted buildQuintilePortfolios (audit
  //     "Factor Monitor always WAIT") — the recorded "leader" was the factor
  //     whose INVERTED (lowest-score) long book rallied hardest, which is
  //     semantically wrong. Those entries are dropped so the corrected
  //     pipeline doesn't inherit corrupt rotation state.
  const QUINTILE_FIX_DATE = '2026-08-29';
  let factorHistory = (prevSnapshot?.crypto_factor_history || [])
    .filter(h => h.date > QUINTILE_FIX_DATE);

  // (b) Backfill when the history is shorter than the rotation window: the
  //     {date, leader} series is reconstructable from the year of candles we
  //     already hold (computeLeadershipHistory uses current quintile
  //     membership applied backwards — the same approximation the crowding
  //     backfill makes). This makes rotation detection (heldSessions, 3-
  //     session confirm) meaningful on day one instead of cold-starting for
  //     weeks. Real post-fix entries (measured with each day's own data) take
  //     precedence over backfilled values for their dates.
  if (factorHistory.length < 90) {
    const byDate = new Map(
      computeLeadershipHistory(portfoliosByFactor, candlesBySymbol, 90)
        .map(h => [h.date, h])
    );
    for (const h of factorHistory) byDate.set(h.date, h);  // real entries win
    factorHistory = [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-90)
      .map(([date, h]) => ({ date, leader: h.leader }));
  }

  // (c) Append today's freshly-computed leader (no-op if today already exists)
  factorHistory = appendToHistory(factorHistory, today, rotation.leader_20d);

  // 9. Compute confirmed rotation from history
  const confirmedRotation = detectRotation(factorHistory);

  // 10. Compute live spread series from the 365d of candles we already have.
  // Used below to (a) record today's daily spread return and (b) BACKFILL the
  // accumulated spread history when it's shorter than the 90-day correlation
  // window.
  const spreadSeries = extractSpreadSeries(portfoliosByFactor, candlesBySymbol, 90);

  // 11. Accumulate daily spread returns for server-side crowding history.
  // Each day we store the latest Q5-Q1 spread return per factor. This builds
  // a 90-day rolling series that can be used for correlation without needing
  // a live candle fetch — the crowding matrix renders instantly from snapshot.
  //
  // (a) One-time purge: entries before 2026-08-29 were computed with the
  //     inverted quintiles (see step 8a) — their spread returns are the
  //     negative-leg swap of the real factors. Dropping them lets the
  //     backfill below rebuild the window with correct values.
  const SPREAD_FIX_DATE = '2026-08-29';
  let spreadHistory = (prevSnapshot?.crypto_factor_spread_history || [])
    .filter(h => h.date > SPREAD_FIX_DATE);
  const todaySpread = { date: today };
  for (const factor of FACTORS) {
    const series = spreadSeries[factor] || [];
    todaySpread[factor] = series.length > 0 ? series[series.length - 1] : null;
  }
  // Don't duplicate if today's entry already exists
  if (spreadHistory.length === 0 || spreadHistory[spreadHistory.length - 1].date !== today) {
    spreadHistory.push(todaySpread);
    // Cap at 90 entries (matching the correlation window)
    if (spreadHistory.length > 90) {
      spreadHistory = spreadHistory.slice(-90);
    }
  }

  // 11b. BACKFILL the spread history when it's shorter than the 90-day
  // correlation window.
  //
  // Audit (2026-08-29, "Factor Monitor always WAIT"): this feature started
  // accumulating crypto_factor_spread_history on 2026-08-26, so the history
  // held only 4 daily entries — far below the 10-point minimum Pearson
  // correlation needs — and the crowding matrix silently degraded to ALL
  // ZEROS (displayed as "max corr 0.00 · not crowded" for every factor,
  // which also made the crowding gate vacuously pass). The live spread
  // series computed in step 10 spans ~90 daily returns from the same candle
  // data; seeding the history with it makes the matrix meaningful on day
  // one. Real accumulated entries (measured with each day's own quintile
  // membership) take precedence over backfilled values for their dates, and
  // as the window rolls the real entries gradually replace the backfill.
  if (spreadHistory.length < 90) {
    const backfill = {};  // date → {factor: daily spread return}
    const now = Date.now();
    for (const factor of FACTORS) {
      const series = spreadSeries[factor] || [];
      const n = Math.min(series.length, 90);
      for (let i = 0; i < n; i++) {
        const date = new Date(now - (n - 1 - i) * 86400000).toISOString().slice(0, 10);
        (backfill[date] = backfill[date] || {})[factor] = series[series.length - n + i];
      }
    }
    const byDate = {};  // date → merged entry (real values win per factor)
    for (const [date, vals] of Object.entries(backfill)) {
      byDate[date] = { date, ...vals };
    }
    for (const h of spreadHistory) {
      const merged = { ...(byDate[h.date] || { date: h.date }) };
      for (const f of FACTORS) {
        if (h[f] != null) merged[f] = h[f];
      }
      merged.date = h.date;
      byDate[h.date] = merged;
    }
    spreadHistory = Object.keys(byDate)
      .sort()
      .slice(-90)
      .map(date => {
        const e = { date };
        for (const f of FACTORS) e[f] = byDate[date][f] ?? null;
        return e;
      });
  }

  // 12. Build crowding matrix from the (backfilled + accumulated) history.
  // This gives us a 90-day correlation matrix without needing live candles.
  const historySpreadSeries = {};
  for (const factor of FACTORS) {
    historySpreadSeries[factor] = spreadHistory
      .map(h => h[factor])
      .filter(v => v != null && Number.isFinite(v));
  }
  const historyCrowding = buildCrowdingMatrix(historySpreadSeries, 90);

  // 12b. Build quilt (monthly returns heatmap) — server-side.
  // This was previously only computed client-side on manual "LIVE REFRESH",
  // which meant the Factor Monitor tab showed no quilt until the user
  // clicked the button. Now it's computed server-side from the same candle
  // data we already have in memory (no extra API calls) and stored in the
  // snapshot so the Factor Monitor renders fully on first paint.
  const quilt = buildQuilt(portfoliosByFactor, candlesBySymbol);

  // 13. Compute factor stances using the canonical computeFactorStance
  // (F-14-b-6 + F-14-b-17, 2026-08-26): now uses the SAME function the
  // client uses, eliminating drift. The snapshot's `stances` field now
  // contains the full FactorStance shape ({ stance, confidence, rationale,
  // color, gates, raw }) so FactorMonitor.jsx can use them directly without
  // recomputing.
  const stances = {};
  for (const row of Object.values(spreadMonitor)) {
    const spread20d = row.spread_20d || {};
    stances[row.factor] = computeFactorStance({
      spreadZ: spread20d.z,
      spreadPctile: spread20d.pctile,
      rotation: confirmedRotation.currentLabel === row.factor ? confirmedRotation : null,
      crowdingScore: historyCrowding.maxCorrelation(row.factor),
      factorName: row.factor,
    });
  }

  console.log(`  ✓ Crypto factors: ${universe.length} assets, leader=${rotation.leader_20d}, history=${factorHistory.length} days, spread_history=${spreadHistory.length} days, quilt=${quilt?.length || 0} months`);

  // 14. Build compact snapshot data (don't store full candle data — too large)
  const factorData = {
    timestamp: new Date().toISOString(),
    as_of: today,
    universe_size: universe.length,
    leader: rotation.leader_20d,
    leader_held_days: confirmedRotation.heldSessions,
    flip_flag: confirmedRotation.flipFlag,
    flip_confirmed: confirmedRotation.confirmed,
    previous_leader: confirmedRotation.previousLabel,
    trailing_20d_returns: rotation.trailing_20d_returns,
    spread_monitor: Object.values(spreadMonitor).map(row => ({
      factor: row.factor,
      label: row.label,
      // All 4 horizons for BOTH rel (long-only minus benchmark) AND spread (Q5-Q1).
      // Previously only stored a subset (spread_20d, rel_20d, spread_5d, spread_1d,
      // spread_60d) — missing rel_1d, rel_5d, rel_60d, rel_ytd, spread_ytd. This
      // caused the Factor Monitor table to show '—' in those cells when reading
      // from snapshot, even though the data was computed. Now all fields are
      // stored so the snapshot view matches the live view's completeness.
      rel_1d:    row.rel_1d    ? { ret: row.rel_1d.ret,    z: row.rel_1d.z,    pctile: row.rel_1d.pctile }    : null,
      rel_5d:    row.rel_5d    ? { ret: row.rel_5d.ret,    z: row.rel_5d.z,    pctile: row.rel_5d.pctile }    : null,
      rel_20d:   row.rel_20d   ? { ret: row.rel_20d.ret,   z: row.rel_20d.z,   pctile: row.rel_20d.pctile }   : null,
      rel_60d:   row.rel_60d   ? { ret: row.rel_60d.ret,   z: row.rel_60d.z,   pctile: row.rel_60d.pctile }   : null,
      spread_1d: row.spread_1d ? { ret: row.spread_1d.ret, z: row.spread_1d.z, pctile: row.spread_1d.pctile } : null,
      spread_5d: row.spread_5d ? { ret: row.spread_5d.ret, z: row.spread_5d.z, pctile: row.spread_5d.pctile } : null,
      spread_20d:row.spread_20d? { ret: row.spread_20d.ret,z: row.spread_20d.z,pctile: row.spread_20d.pctile }: null,
      spread_60d:row.spread_60d? { ret: row.spread_60d.ret,z: row.spread_60d.z,pctile: row.spread_60d.pctile }: null,
      // YTD (ret only — the engine doesn't compute z/pctile for YTD)
      rel_ytd:    row.rel_ytd    || null,
      spread_ytd: row.spread_ytd || null,
    })),
    // Server-side crowding matrix (computed from 90-day accumulated history)
    crowding: {
      matrix: historyCrowding.matrix,
      max_correlations: Object.fromEntries(
        FACTORS.map(f => [f, historyCrowding.maxCorrelation(f)])
      ),
    },
    // Server-side stances (computed from spread z + crowding + rotation)
    stances,
    // Quilt — monthly returns heatmap for each factor portfolio.
    // Small data (~13 months × 5 factors × {factor, label, return} ≈ 2 KB).
    // Previously this was null in the snapshot → Factor Monitor required
    // a manual live refresh to display the quilt. Now it's always available.
    quilt: quilt || [],
  };

  return {
    factorData,
    factorHistory,
    spreadHistory,
  };
}

// F-14-b-6 + F-14-b-17 (2026-08-26): the local `computeStanceFromSpread`
// function has been deleted. The server now imports `computeFactorStance`
// from `../src/lib/factors/compositeEngine.js` and uses it directly, so the
// server and client share a single canonical implementation. The snapshot's
// `stances` field now contains the full FactorStance shape (stance,
// confidence, rationale, color, gates, raw) — FactorMonitor.jsx can use
// them directly without recomputing client-side.
