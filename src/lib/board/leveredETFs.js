/**
 * Leveraged ETF universe — 93 ETFs with structured metadata.
 *
 * Ported from SMB (Stable Market Board) data/levered_etfs.csv.
 * Each ETF has: ticker, label, category, direction (Long/Short),
 * leverage factor, and underlying ticker.
 *
 * Categories:
 *   Index (18)       — 2x/3x S&P 500, Nasdaq-100, Russell 2000, Dow 30
 *   Sector (26)      — 2x/3x Semis, Tech, Financials, Biotech, Energy, etc.
 *   Single Stock (28)— 2x NVDA, TSLA, MSTR, COIN, PLTR, AAPL, AMZN, etc.
 *   Volatility (4)   — 2x VIX futures (UVIX, UVXY), -1x/-0.5x VIX (SVIX, SVXY)
 *   Crypto (6)       — 2x BTC, 2x ETH + inverses
 *   Commodity (8)    — ±2x NatGas, Crude, Silver, Gold
 *   Bonds (3)        — ±3x/±2x 20Y Treasury
 *
 * Used by:
 *   - Board Levered ETF tab (z-score normalized moves, long/short risk-appetite)
 *   - Scanner (these tickers are also in TRAD_UNIVERSE for scanning)
 */

export const LEVERED_ETFS = [
  // ═══ Index (18) ═══
  { ticker: 'TQQQ', label: '3x Nasdaq-100',           category: 'Index',       direction: 'Long',  leverage: 3,   underlying: 'QQQ' },
  { ticker: 'QLD',  label: '2x Nasdaq-100',           category: 'Index',       direction: 'Long',  leverage: 2,   underlying: 'QQQ' },
  { ticker: 'UPRO', label: '3x S&P 500',              category: 'Index',       direction: 'Long',  leverage: 3,   underlying: 'SPY' },
  { ticker: 'SPXL', label: '3x S&P 500',              category: 'Index',       direction: 'Long',  leverage: 3,   underlying: 'SPY' },
  { ticker: 'SSO',  label: '2x S&P 500',              category: 'Index',       direction: 'Long',  leverage: 2,   underlying: 'SPY' },
  { ticker: 'TNA',  label: '3x Russell 2000',         category: 'Index',       direction: 'Long',  leverage: 3,   underlying: 'IWM' },
  { ticker: 'UWM',  label: '2x Russell 2000',         category: 'Index',       direction: 'Long',  leverage: 2,   underlying: 'IWM' },
  { ticker: 'UDOW', label: '3x Dow 30',               category: 'Index',       direction: 'Long',  leverage: 3,   underlying: 'DIA' },
  { ticker: 'SQQQ', label: '-3x Nasdaq-100',          category: 'Index',       direction: 'Short', leverage: -3,  underlying: 'QQQ' },
  { ticker: 'QID',  label: '-2x Nasdaq-100',          category: 'Index',       direction: 'Short', leverage: -2,  underlying: 'QQQ' },
  { ticker: 'PSQ',  label: '-1x Nasdaq-100',          category: 'Index',       direction: 'Short', leverage: -1,  underlying: 'QQQ' },
  { ticker: 'SPXU', label: '-3x S&P 500',             category: 'Index',       direction: 'Short', leverage: -3,  underlying: 'SPY' },
  { ticker: 'SPXS', label: '-3x S&P 500',             category: 'Index',       direction: 'Short', leverage: -3,  underlying: 'SPY' },
  { ticker: 'SDS',  label: '-2x S&P 500',             category: 'Index',       direction: 'Short', leverage: -2,  underlying: 'SPY' },
  { ticker: 'SH',   label: '-1x S&P 500',             category: 'Index',       direction: 'Short', leverage: -1,  underlying: 'SPY' },
  { ticker: 'TZA',  label: '-3x Russell 2000',        category: 'Index',       direction: 'Short', leverage: -3,  underlying: 'IWM' },
  { ticker: 'TWM',  label: '-2x Russell 2000',        category: 'Index',       direction: 'Short', leverage: -2,  underlying: 'IWM' },
  { ticker: 'SDOW', label: '-3x Dow 30',              category: 'Index',       direction: 'Short', leverage: -3,  underlying: 'DIA' },

  // ═══ Sector (26) ═══
  { ticker: 'SOXL', label: '3x Semiconductors',       category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'SOXX' },
  { ticker: 'USD',  label: '2x Semiconductors',       category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'SOXX' },
  { ticker: 'TECL', label: '3x Technology',           category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XLK' },
  { ticker: 'ROM',  label: '2x Technology',           category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'XLK' },
  { ticker: 'FAS',  label: '3x Financials',           category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XLF' },
  { ticker: 'LABU', label: '3x Biotech',              category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XBI' },
  { ticker: 'NAIL', label: '3x Homebuilders',         category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'ITB' },
  { ticker: 'DPST', label: '3x Regional Banks',       category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'KRE' },
  { ticker: 'DRN',  label: '3x Real Estate',          category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'IYR' },
  { ticker: 'ERX',  label: '2x Energy',               category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'XLE' },
  { ticker: 'GUSH', label: '2x Oil & Gas E&P',        category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'XOP' },
  { ticker: 'NUGT', label: '2x Gold Miners',          category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'GDX' },
  { ticker: 'JNUG', label: '2x Jr Gold Miners',       category: 'Sector',      direction: 'Long',  leverage: 2,   underlying: 'GDXJ' },
  { ticker: 'CURE', label: '3x Healthcare',           category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XLV' },
  { ticker: 'RETL', label: '3x Retail',               category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XRT' },
  { ticker: 'UTSL', label: '3x Utilities',            category: 'Sector',      direction: 'Long',  leverage: 3,   underlying: 'XLU' },
  { ticker: 'SOXS', label: '-3x Semiconductors',      category: 'Sector',      direction: 'Short', leverage: -3,  underlying: 'SOXX' },
  { ticker: 'SSG',  label: '-2x Semiconductors',      category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'SOXX' },
  { ticker: 'TECS', label: '-3x Technology',          category: 'Sector',      direction: 'Short', leverage: -3,  underlying: 'XLK' },
  { ticker: 'REW',  label: '-2x Technology',          category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'XLK' },
  { ticker: 'FAZ',  label: '-3x Financials',          category: 'Sector',      direction: 'Short', leverage: -3,  underlying: 'XLF' },
  { ticker: 'LABD', label: '-3x Biotech',             category: 'Sector',      direction: 'Short', leverage: -3,  underlying: 'XBI' },
  { ticker: 'ERY',  label: '-2x Energy',              category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'XLE' },
  { ticker: 'DRIP', label: '-2x Oil & Gas E&P',       category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'XOP' },
  { ticker: 'DUST', label: '-2x Gold Miners',         category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'GDX' },
  { ticker: 'JDST', label: '-2x Jr Gold Miners',      category: 'Sector',      direction: 'Short', leverage: -2,  underlying: 'GDXJ' },
  { ticker: 'DRV',  label: '-3x Real Estate',         category: 'Sector',      direction: 'Short', leverage: -3,  underlying: 'IYR' },

  // ═══ Single Stock (28) ═══
  { ticker: 'NVDL', label: '2x NVIDIA',               category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'NVDA' },
  { ticker: 'NVDU', label: '2x NVIDIA',               category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'NVDA' },
  { ticker: 'TSLL', label: '2x Tesla',                category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'TSLA' },
  { ticker: 'TSLT', label: '2x Tesla',                category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'TSLA' },
  { ticker: 'MSTU', label: '2x MicroStrategy',        category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'MSTR' },
  { ticker: 'MSTX', label: '2x MicroStrategy',        category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'MSTR' },
  { ticker: 'CONL', label: '2x Coinbase',             category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'COIN' },
  { ticker: 'PLTU', label: '2x Palantir',             category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'PLTR' },
  { ticker: 'AMDL', label: '2x AMD',                  category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'AMD' },
  { ticker: 'MUU',  label: '2x Micron',               category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'MU' },
  { ticker: 'SNXX', label: '2x SanDisk',              category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'SNDK' },
  { ticker: 'WDCX', label: '2x Western Digital',      category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'WDC' },
  { ticker: 'STXX', label: '2x Seagate',              category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'STX' },
  { ticker: 'UPSX', label: '2x Upstart',              category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'UPST' },
  { ticker: 'TARK', label: '2x ARKK',                 category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'ARKK' },
  { ticker: 'AAPU', label: '2x Apple',                category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'AAPL' },
  { ticker: 'AAPB', label: '2x Apple',                category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'AAPL' },
  { ticker: 'AMZU', label: '2x Amazon',               category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'AMZN' },
  { ticker: 'MSFU', label: '2x Microsoft',            category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'MSFT' },
  { ticker: 'METU', label: '2x Meta',                 category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'META' },
  { ticker: 'GGLL', label: '2x Alphabet',             category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'GOOGL' },
  { ticker: 'AVL',  label: '2x Broadcom',             category: 'Single Stock', direction: 'Long',  leverage: 2,    underlying: 'AVGO' },
  { ticker: 'NVDS', label: '-1.5x NVIDIA',            category: 'Single Stock', direction: 'Short', leverage: -1.5, underlying: 'NVDA' },
  { ticker: 'TSLQ', label: '-2x Tesla',               category: 'Single Stock', direction: 'Short', leverage: -2,  underlying: 'TSLA' },
  { ticker: 'TSLZ', label: '-2x Tesla',               category: 'Single Stock', direction: 'Short', leverage: -2,  underlying: 'TSLA' },
  { ticker: 'MSTZ', label: '-2x MicroStrategy',       category: 'Single Stock', direction: 'Short', leverage: -2,  underlying: 'MSTR' },
  { ticker: 'SNDQ', label: '-2x SanDisk',             category: 'Single Stock', direction: 'Short', leverage: -2,  underlying: 'SNDK' },
  { ticker: 'SARK', label: '-1x ARKK',                category: 'Single Stock', direction: 'Short', leverage: -1,  underlying: 'ARKK' },

  // ═══ Volatility (4) ═══
  // Audit F-14-f-4: UVIX and UVXY are LONG VOLATILITY ETFs (hedge products that rise
  // when VIX spikes / market crashes). Their `direction: 'Short'` reflects their
  // hedging posture, not their underlying VIX exposure direction.
  { ticker: 'UVIX', label: '2x VIX Futures',          category: 'Volatility',  direction: 'Short', leverage: 2,   underlying: 'VIX' },
  { ticker: 'UVXY', label: '1.5x VIX Futures',        category: 'Volatility',  direction: 'Short', leverage: 1.5, underlying: 'VIX' },
  { ticker: 'SVIX', label: '-1x VIX Futures',         category: 'Volatility',  direction: 'Short', leverage: -1,  underlying: 'VIX' },
  { ticker: 'SVXY', label: '-0.5x VIX Futures',       category: 'Volatility',  direction: 'Short', leverage: -0.5, underlying: 'VIX' },

  // ═══ Crypto (6) ═══
  { ticker: 'BITX', label: '2x Bitcoin',              category: 'Crypto',      direction: 'Long',  leverage: 2,   underlying: 'BTC' },
  { ticker: 'BITU', label: '2x Bitcoin',              category: 'Crypto',      direction: 'Long',  leverage: 2,   underlying: 'BTC' },
  { ticker: 'ETHU', label: '2x Ether',                category: 'Crypto',      direction: 'Long',  leverage: 2,   underlying: 'ETH' },
  { ticker: 'SBIT', label: '-2x Bitcoin',             category: 'Crypto',      direction: 'Short', leverage: -2,  underlying: 'BTC' },
  { ticker: 'ETHD', label: '-2x Ether',               category: 'Crypto',      direction: 'Short', leverage: -2,  underlying: 'ETH' },

  // ═══ Commodity (8) ═══
  { ticker: 'BOIL', label: '2x Natural Gas',          category: 'Commodity',   direction: 'Long',  leverage: 2,   underlying: 'NG' },
  { ticker: 'KOLD', label: '-2x Natural Gas',         category: 'Commodity',   direction: 'Short', leverage: -2,  underlying: 'NG' },
  { ticker: 'UCO',  label: '2x Crude Oil',            category: 'Commodity',   direction: 'Long',  leverage: 2,   underlying: 'CL' },
  { ticker: 'SCO',  label: '-2x Crude Oil',           category: 'Commodity',   direction: 'Short', leverage: -2,  underlying: 'CL' },
  { ticker: 'AGQ',  label: '2x Silver',               category: 'Commodity',   direction: 'Long',  leverage: 2,   underlying: 'SI' },
  { ticker: 'ZSL',  label: '-2x Silver',              category: 'Commodity',   direction: 'Short', leverage: -2,  underlying: 'SI' },
  { ticker: 'UGL',  label: '2x Gold',                 category: 'Commodity',   direction: 'Long',  leverage: 2,   underlying: 'GC' },
  { ticker: 'GLL',  label: '-2x Gold',                category: 'Commodity',   direction: 'Short', leverage: -2,  underlying: 'GC' },

  // ═══ Bonds (3) ═══
  { ticker: 'TMF',  label: '3x 20Y Treasury',         category: 'Bonds',       direction: 'Long',  leverage: 3,   underlying: 'TLT' },
  { ticker: 'TMV',  label: '-3x 20Y Treasury',        category: 'Bonds',       direction: 'Short', leverage: -3,  underlying: 'TLT' },
  { ticker: 'TBT',  label: '-2x 20Y Treasury',        category: 'Bonds',       direction: 'Short', leverage: -2,  underlying: 'TLT' },
];

// Category display order (matches SMB's levered.py CATEGORY_ORDER)
export const LEVERED_CATEGORY_ORDER = [
  'Index', 'Sector', 'Single Stock', 'Volatility', 'Crypto', 'Commodity', 'Bonds'
];

// Quick lookup: Set of all levered ETF tickers (for membership checks)
export const LEVERED_TICKERS = new Set(LEVERED_ETFS.map(e => e.ticker));

// Get all levered ETF tickers that should be added to TRAD_UNIVERSE
// (excludes tickers already in TRAD_UNIVERSE — caller should dedupe)
export function getLeveredTickerList() {
  return LEVERED_ETFS.map(e => e.ticker);
}

// Group levered ETFs by category, sorted by |leverage| within each group
export function getLeveredByCategory() {
  const groups = {};
  for (const cat of LEVERED_CATEGORY_ORDER) {
    groups[cat] = LEVERED_ETFS
      .filter(e => e.category === cat)
      .sort((a, b) => Math.abs(b.leverage) - Math.abs(a.leverage));
  }
  return groups;
}
