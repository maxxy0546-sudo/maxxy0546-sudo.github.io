import { fetchCandles } from './exchanges';
import { analyseBreakout } from './breakoutEngine';

const TIMEFRAME_MAP = {
  local: '4h',
  '1m': '4h',
  '3m': '1d',
  '1y': '1d',
  '5y': '1w',
};

async function fetchBreakoutCandles(
  symbol,
  exchange,
  timeframe
) {
  let candles = await fetchCandles(
    symbol,
    exchange,
    timeframe
  );

  // Same fallback behaviour as the existing TrendScan scanner.
  if ((!candles || candles.length < 2) && exchange !== 'auto') {
    candles = await fetchCandles(
      symbol,
      'auto',
      timeframe
    );
  }

  return candles;
}

export async function analyseBreakoutAsset(
  asset,
  {
    windowId = '1m',
    exchange = 'auto',
    approachingPct = 2,
    breakingPct = 2,
  } = {}
) {
  if (!asset?.symbol) return null;

  const timeframe =
    TIMEFRAME_MAP[windowId] ?? '1d';

  try {
    const candles = await fetchBreakoutCandles(
      asset.symbol,
      exchange,
      timeframe
    );

    if (!candles || candles.length < 2) {
      return null;
    }

    const breakout = analyseBreakout(
      candles,
      windowId,
      {
        approachingPct,
        breakingPct,
      }
    );

    if (!breakout) return null;

    return {
      ...asset,
      ...breakout,
      symbol: asset.symbol,
      name: asset.name ?? asset.symbol,
      timeframe,
    };
  } catch (error) {
    console.warn(
      `[breakout] ${asset.symbol} failed:`,
      error
    );

    return null;
  }
}

export async function runBreakoutScan(
  assets,
  {
    windowId = '1m',
    state = 'breaking',
    exchange = 'auto',
    approachingPct = 2,
    breakingPct = 2,
    concurrency = 6,
    onProgress,
  } = {}
) {
  if (!Array.isArray(assets) || !assets.length) {
    return [];
  }

  const results = [];

  let completed = 0;

  // Work in small batches so we don't hammer the
  // exchange APIs with hundreds of requests at once.
  for (
    let i = 0;
    i < assets.length;
    i += concurrency
  ) {
    const batch = assets.slice(
      i,
      i + concurrency
    );

    const batchResults = await Promise.all(
      batch.map(asset =>
        analyseBreakoutAsset(asset, {
          windowId,
          exchange,
          approachingPct,
          breakingPct,
        })
      )
    );

    for (const result of batchResults) {
      if (!result) continue;

      if (
        state === 'all' ||
        result.state === state
      ) {
        results.push(result);
      }
    }

    completed += batch.length;

    if (typeof onProgress === 'function') {
      onProgress({
        completed: Math.min(
          completed,
          assets.length
        ),
        total: assets.length,
        matched: results.length,
      });
    }
  }

  // Closest to the breakout level first.
  return results.sort(
    (a, b) =>
      Math.abs(a.distancePct) -
      Math.abs(b.distancePct)
  );
}
