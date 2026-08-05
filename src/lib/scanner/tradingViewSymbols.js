/**
 * Maps a Screener exchange + interval to TradingView's symbol/interval conventions.
 * Best-effort mappings based on documented TradingView conventions.
 *
 * Hyperliquid perpetuals on TradingView use the USDC.P suffix (e.g. BTCUSDC.P),
 * confirmed against TradingView's symbol search.
 *
 * For TradFi mode (exchange='auto', 'snapshot', or tradfi perp tickers on
 * binance_perps/okx_perps), maps to TradingView's equity exchange prefixes
 * (SP = S&P, NASDAQ, NYSE, TVC for commodities, etc.).
 */

const EXCHANGE_MAP = {
  hyperliquid:    { prefix: 'HYPERLIQUID', suffix: 'USDC.P' },   // confirmed: BTCUSDC.P
  okx_perps:      { prefix: 'OKX',         suffix: 'USDT.P' },
  okx:            { prefix: 'OKX',         suffix: 'USDT' },
  binance_perps:  { prefix: 'BINANCE',     suffix: 'USDT.P' },
  binance:        { prefix: 'BINANCE',     suffix: 'USDT' },
  kraken:         { prefix: 'KRAKEN',      suffix: 'USD' },
  bybit:          { prefix: 'BYBIT',       suffix: 'USDT.P' },
  // CoinGecko isn't a tradeable venue and has no chart data of its own —
  // fall back to Binance spot, the broadest-coverage venue in this list.
  coingecko:      { prefix: 'BINANCE',     suffix: 'USDT' },
};

// TradFi symbol → TradingView prefix mapping.
// Used when the scanner is in TradFi mode (exchange='auto' or 'snapshot'),
// or when a tradfi ticker is selected from Binance/OKX perps.
// Source: TradingView symbol search (verified Aug 2026).
const TRADFI_TV_PREFIX = {
  // US indices / ETFs
  SPY: 'SP', QQQ: 'NASDAQ', DIA: 'NYSE', IWM: 'ARCA',
  // Major US stocks
  NVDA: 'NASDAQ', TSLA: 'NASDAQ', AAPL: 'NASDAQ', AMZN: 'NASDAQ',
  GOOGL: 'NASDAQ', MSFT: 'NASDAQ', META: 'NASDAQ', AMD: 'NASDAQ',
  INTC: 'NASDAQ', NFLX: 'NASDAQ', COIN: 'NASDAQ', MSTR: 'NASDAQ',
  HOOD: 'NASDAQ', PLTR: 'NYSE', GME: 'NYSE', DIS: 'NYSE',
  JPM: 'NYSE', GS: 'NYSE', V: 'NYSE', MA: 'NYSE', WMT: 'NYSE',
  COST: 'NASDAQ', HD: 'NASDAQ', PYPL: 'NASDAQ', ADBE: 'NASDAQ',
  CRM: 'NYSE', ORCL: 'NYSE', IBM: 'NYSE', CSCO: 'NASDAQ',
  QCOM: 'NASDAQ', AVGO: 'NASDAQ', TXN: 'NASDAQ', MU: 'NASDAQ',
  AMAT: 'NASDAQ', LRCX: 'NASDAQ', MRVL: 'NASDAQ', AAOI: 'NASDAQ',
  CIEN: 'NYSE', LITE: 'NYSE', ON: 'NASDAQ',
  // Commodities (TradingView TVC prefix)
  XAU: 'TVC:GOLD', XAG: 'TVC:SILVER', XPT: 'TVC:PLATINUM',
  XPD: 'TVC:PALLADIUM', XCU: 'TVC:COPPER',
  // Sector ETFs
  XLE: 'ARCA', XBI: 'NASDAQ', USO: 'ARCA',
  // Leveraged ETFs
  TQQQ: 'NASDAQ', SQQQ: 'NASDAQ', SOXL: 'ARCA', SOXS: 'ARCA',
  UVXY: 'BATS', TZA: 'ARCA', TMF: 'ARCA', TBT: 'NASDAQ',
  // Country ETFs
  EWJ: 'ARCA', EWY: 'ARCA', EWZ: 'ARCA', EWT: 'ARCA',
  // Asian stocks
  TENCENT: 'HKEX', HK0700: 'HKEX', HK1810: 'HKEX', SAMSUNG: 'KRX',
  SKHYNIX: 'KRX', HYUNDAI: 'KRX', POPMART: 'HKEX', SONY: 'NYSE',
  NOK: 'NYSE', BABA: 'NYSE',
  // Private companies (TradingView may not have charts)
  OPENAI: 'PRIVATE', ANTHROPIC: 'PRIVATE', SPACEX: 'PRIVATE',
  MINIMAX: 'PRIVATE', ZHIPU: 'PRIVATE',
};

// Build a reverse lookup: for symbols that map to a full TV symbol (e.g. XAU→TVC:GOLD)
const TRADFI_TV_FULL = {
  XAU: 'TVC:GOLD', XAG: 'TVC:SILVER', XPT: 'TVC:PLATINUM',
  XPD: 'TVC:PALLADIUM', XCU: 'TVC:COPPER',
};

const INTERVAL_MAP = {
  '15m': '15',
  '30m': '30',
  '1H':  '60',
  '4H':  '240',
  '12H': '720',
  '1D':  'D',
  '1W':  'W',
};

/** @param {string} symbol - e.g. "BTC" or "SPY" or "NVDA" */
/** @param {string} exchange - e.g. "hyperliquid" or "auto" (tradfi) */
/** @returns {string} e.g. "HYPERLIQUID:BTCUSD.P" or "NASDAQ:NVDA" */
export function toTradingViewSymbol(symbol, exchange) {
  const sym = symbol.toUpperCase();

  // TradFi mode: exchange is 'auto' or 'snapshot', OR the symbol is a known tradfi ticker
  if (exchange === 'auto' || exchange === 'snapshot' || TRADFI_TV_PREFIX[sym]) {
    // Full mapping (e.g. XAU → TVC:GOLD)
    if (TRADFI_TV_FULL[sym]) return TRADFI_TV_FULL[sym];
    // Prefix mapping (e.g. NVDA → NASDAQ:NVDA)
    const prefix = TRADFI_TV_PREFIX[sym];
    if (prefix) return `${prefix}:${sym}`;
    // Unknown tradfi ticker — fall back to SMART (TradingView auto-resolves)
    return `SMART:${sym}`;
  }

  // Crypto mode
  const map = EXCHANGE_MAP[exchange] || EXCHANGE_MAP.binance;
  return `${map.prefix}:${symbol}${map.suffix}`;
}

/** @param {string} timeframe - e.g. "4H" */
/** @returns {string} TradingView interval code, e.g. "240" or "D" */
export function toTradingViewInterval(timeframe) {
  return INTERVAL_MAP[timeframe] || '240';
}
