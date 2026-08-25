/**
 * Binance xStocks — free, no API key, CORS-enabled (when called from browser)
 * Very limited tradfi coverage: NVDABUSDT, TSLABUSDT (verified Jun 2026).
 *
 * Docs: https://developers.binance.com/docs/binance-spot-api-api
 */

import { fetchWithTimeout } from '../fetchWithTimeout';
import { markGloballyBlocked } from '../sourceHealth';

const SOURCE_ID = 'binance_xstocks';
const BASE = 'https://api.binance.com/api/v3';

const TIMEFRAME_INTERVAL = {
  '15m': '15m',
  '30m': '30m',
  '1H': '1h',
  '4H': '4h',
  '12H': '12h',
  '1D': '1d',
  '1w': '1w',
  '1W': '1w',
};

// Binance xStocks symbols currently whitelisted for the scanner resolver.
// Binance actually lists more xStocks tokens (NVDAX, TSLAX, AAPLX, MSFTX,
// GOOGLX, AMZNX, METAAX, etc. — see CMC's `xstocks-ecosystem` tag), but
// they are filtered out of the Screener universe by `TOKENIZED_TAGS` in
// src/lib/scanner/constants.js (tokenized stocks are TradFi, not crypto).
// This whitelist exists for the tradfi resolver path only — if you want to
// add more xStocks for tradfi coverage, add the bare ticker (e.g. 'AAPL')
// here and the fetcher will build the ${sym}XUSDT pair automatically.
export const TRADFI_SYMBOLS = new Set(['NVDA', 'TSLA']);

export function isTradfi(symbol) {
  return TRADFI_SYMBOLS.has(symbol.toUpperCase());
}

export async function fetchCandles(symbol, timeframe = '1D', limit = 300) {
  const interval = TIMEFRAME_INTERVAL[timeframe] || '1d';
  // xStocks on Binance use X suffix + USDT quote (e.g. NVDAXUSDT, TSLAXUSDT)
  const sym = `${symbol.toUpperCase()}XUSDT`;
  const url = `${BASE}/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(limit, 1000)}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      // Audit F-14-e-8 (2026-08-26): mirror binanceSpot.js / binancePerps.js —
      // HTTP 451 is a definitive geo-block signal. Without markGloballyBlocked,
      // the resolver would burn 3 retries per symbol before deprioritizing,
      // wasting ~10-15s on every xStocks scan in geo-blocked regions.
      if (res.status === 451) markGloballyBlocked(SOURCE_ID);
      return null;
    }
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;

    return arr.map(c => ({
      ts: parseInt(c[0]),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      vol: parseFloat(c[5]),
    }));
  } catch (e) {
    console.warn(`[binanceXStocks] ${symbol} failed: ${e.message}`);
    return null;
  }
}

export const sourceMeta = {
  id: 'binance_xstocks',
  type: 'tradfi',
  supportsTimeframes: ['15m', '30m', '1H', '4H', '12H', '1D', '1w', '1W'],
  rateLimitPerMin: 1200,
  requiresApiKey: false,
  maxCandlesPerCall: 1000,
};
