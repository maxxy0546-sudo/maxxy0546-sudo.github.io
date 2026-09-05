import { fetchCandles, fetchTop500 } from './exchanges';
import { analyseBreakout, BREAKOUT_STATES } from './breakoutEngine';

const TIMEFRAME_MAP = {
  local: '4H',
  '1m': '4H',
  '3m': '1D',
  '1y': '1W',
  '5y': '1W',
};

async function fetchBreakoutCandles(symbol, exchange, timeframe) {
  let candles = await fetchCandles(symbol, exchange, timeframe);

  // Breakout scans use AUTO by default so the resolver can fall through
  // OKX → Bybit → Kraken → Hyperliquid → Yahoo → Binance → CoinGecko.
  if ((!candles || candles.length < 2) && exchange !== 'auto') {
    candles = await fetchCandles(symbol, 'auto', timeframe);
  }

  return candles;
}

async function analyseAsset(asset, options) {
  const {
    windowId,
    exchange,
    approachingPct,
    breakingPct,
  } = options;

  if (!asset?.symbol) return null;

  const timeframe = TIMEFRAME_MAP[windowId] ?? '1D';

  try {
    const candles = await fetchBreakoutCandles(
      asset.symbol,
      exchange,
      timeframe
    );

    if (!candles || candles.length < 2) return null;

    const breakout = analyseBreakout(candles, windowId, {
      approachingPct,
      breakingPct,
    });

    if (!breakout) return null;

    return {
      ...asset,
      ...breakout,
      symbol: asset.symbol,
      name: asset.name ?? asset.symbol,
      timeframe,
    };
  } catch (err) {
    console.warn(`[breakout] ${asset.symbol} failed`, err);
    return null;
  }
}

function matchesSelectedState(result, breakoutState) {
  if (breakoutState === 'all') {
    // "All" means all breakout-relevant states, not every coin in the universe.
    return result.state !== BREAKOUT_STATES.BELOW;
  }
  return result.state === breakoutState;
}

export async function runBreakoutScan(settings, onProgress) {
  const startTime = Date.now();

  const windowId = settings.breakoutWindow ?? '1m';
  const breakoutState = settings.breakoutState ?? 'breaking';

  // Keep breakout data-source selection independent from the normal trend
  // scanner. AUTO is important for long lookbacks because the resolver knows
  // which sources support weekly/daily history and can fall back automatically.
  const exchange = settings.breakoutExchange ?? 'auto';

  const approachingPct = settings.approachingPct ?? 2;
  const breakingPct = settings.breakingPct ?? 2;
  const concurrency = 6;

  onProgress({
    phase: 'fetching_universe',
    done: 0,
    total: 0,
    matched: 0,
    message: 'Fetching Top 500 for breakout scan…',
  });

  // Reuse the exact same filtered Top-500 universe as the normal scanner.
  const assets = await fetchTop500(settings.cgKey);
  const total = assets.length;
  const results = [];

  onProgress({
    phase: 'scanning',
    done: 0,
    total,
    matched: 0,
    results: [],
    message: `Scanning ${total} assets for ${windowId.toUpperCase()} breakouts…`,
  });

  let completed = 0;

  // Small batches avoid hammering exchange APIs from the browser.
  for (let i = 0; i < assets.length; i += concurrency) {
    const batch = assets.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(asset =>
        analyseAsset(asset, {
          windowId,
          exchange,
          approachingPct,
          breakingPct,
        })
      )
    );

    for (const result of batchResults) {
      if (!result) continue;
      if (matchesSelectedState(result, breakoutState)) results.push(result);
    }

    completed += batch.length;

    // Closest to the breakout level first.
    results.sort(
      (a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)
    );

    onProgress({
      phase: 'scanning',
      done: Math.min(completed, total),
      total,
      matched: results.length,
      results: [...results],
      message:
        `${Math.min(completed, total)}/${total} scanned · ` +
        `${results.length} ${breakoutState} matches`,
    });
  }

  const duration = Date.now() - startTime;

  onProgress({
    phase: 'complete',
    done: total,
    total,
    matched: results.length,
    results,
    updatedAt: Date.now(),
    duration,
    message: `${results.length} breakout matches`,
  });

  return results;
}
