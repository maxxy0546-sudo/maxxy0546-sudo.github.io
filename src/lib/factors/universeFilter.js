/**
 * Universe Filter — excludes price-PEGGED and non-tradable assets from the
 * crypto factor universe.
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): the factor universe was
 * built from raw top-100-by-market-cap, which includes USD stablecoins
 * (USDT, USDC, DAI, USDE, USD1, PYUSD, ...), tokenized gold (XAUT, PAXG),
 * wrapped/staked derivatives (WBTC, WSTETH, ...), and exchange revenue
 * tokens (LEO, OKB, BGB, KCS, GT). 12 such assets made it into the traded
 * universe and 9 stablecoins sat in quintile portfolios:
 *
 *   - The "Low Volatility" Q1 held 9 stablecoins + gold (their 30d stdev is
 *     ~0), so that "factor" was really "alts vs stables".
 *   - Stablecoin momentum ≈ 0 out-ranked genuinely negative alt momentum in
 *     a down market, polluting the momentum quintiles.
 *   - Stablecoins' massive turnover/mcap ratios dominated the liquidity
 *     factor's top quintile.
 *
 * These assets have no factor exposure — they're pegs. Any factor model that
 * includes them measures "pegged vs unpegged", not the factor itself.
 *
 * Shared by BOTH the server (scripts/compute_crypto_factors.js, CMC data)
 * and the client live-refresh path (FactorMonitor.jsx, CoinGecko data) so
 * the two universes agree.
 *
 * Filtering layers (any one excludes):
 *   1. Symbol denylist — covers pegged/wrapped tickers and exchange-native
 *      revenue tokens that carry no CMC category tags.
 *   2. CMC category tags — 'stablecoin', 'tokenized-gold',
 *      'wrapped-tokens', 'liquid-staking-derivatives' (server path only;
 *      CoinGecko market data doesn't include tags).
 *   3. Name heuristic — backstop for tagged-data absences (e.g. the client
 *      path has no tags): matches "usd"/"dollar"/"euro"-style stablecoin
 *      names, "wrapped", "staked", "bridged", "restaked", "peg".
 */

/**
 * Symbols excluded regardless of tags/names.
 * Keep alphabetized. Add sparingly — every entry here is a judgment call
 * that should be justifiable in one line:
 *   - USD/fiat stablecoins: pegged by design, zero factor exposure.
 *   - Tokenized gold: pegged to metal, not a crypto factor bet.
 *   - Wrapped/staked/LST: pegged to an underlying that's already in the
 *     universe (WBTC ≈ BTC, WSTETH ≈ ETH) — including both double-counts.
 *   - Exchange revenue tokens (LEO/OKB/BGB/KCS/GT/HT/WXT): trade primarily
 *     on their issuing exchange, mostly absent from OKX/Bybit perp listings
 *     the candle fetcher uses, and price behavior is venue-policy-driven.
 */
const EXCLUDED_SYMBOLS = new Set([
  // ── fiat / crypto-collateralized stablecoins ──
  'BUSD', 'CRVUSD', 'DAI', 'EURC', 'EURS', 'FDUSD', 'FRAX', 'GUSD',
  'LUSD', 'PAXG', 'PYUSD', 'RLUSD', 'TUSD', 'USDC', 'USDD', 'USDE',
  'USDF', 'USD0', 'USD1', 'USDM', 'USDP', 'USDS', 'USDT', 'USDTB', 'USDG', 'USDY',
  // ── tokenized gold / metals ──
  'XAUT',
  // ── wrapped / staked / LST derivatives (underlying already in universe) ──
  'BNSOL', 'CBBTC', 'CLBTC', 'EZETH', 'FBTC', 'JITOSOL', 'LBTC', 'MSOL',
  'RETH', 'RSETH', 'SOLVBTC', 'STETH', 'SWETH', 'TBTC', 'WBETH', 'WBTC',
  'WEETH', 'WETH', 'WSTETH',
  // ── exchange revenue tokens (single-venue, no perp listings) ──
  'BGB', 'GT', 'HT', 'KCS', 'LEO', 'OKB', 'WXT',
]);

/**
 * CMC category tags that mark an asset as pegged/derivative.
 * (Only available on the server path — CMC metadata.)
 */
const EXCLUDED_TAGS = new Set([
  'stablecoin',
  'stablecoin-protocol',
  'tokenized-gold',
  'wrapped-tokens',
  'liquid-staking-derivatives',
]);

/**
 * Name-based backstop for data sources without tags (client CoinGecko path).
 * Matched case-insensitively as substrings; deliberately conservative to
 * avoid false positives (e.g. must NOT match "Bitcoin").
 */
const EXCLUDED_NAME_PATTERNS = [
  /\busd\b/i,            // "Tether USDt", "First Digital USD", "USD Coin"
  /usd[- ]?(coin|t|c|e|token)/i,
  /\bdollar\b/i,
  /\beuro\b/i,
  /\bwrapped\b/i,        // "Wrapped Bitcoin", "Wrapped Ether"
  /\bstaked\b/i,         // "Lido wstETH" tagged; name backstop
  /\bbridged\b/i,
  /\brestaked\b/i,
  /\bpeg\b/i,
  /\bgold\b/i,           // "PAX Gold", "Tether Gold"
];

/**
 * Should this asset be EXCLUDED from the factor universe?
 *
 * @param {object} asset - {symbol, name?, tags?}
 * @returns {boolean}
 */
export function isExcludedAsset(asset) {
  if (!asset) return true;
  const symbol = (asset.symbol || '').toUpperCase();
  if (!symbol) return true;
  if (EXCLUDED_SYMBOLS.has(symbol)) return true;

  // Tag-based (server / CMC path — most reliable signal)
  const tags = Array.isArray(asset.tags) ? asset.tags : [];
  if (tags.some(t => EXCLUDED_TAGS.has(t))) return true;

  // Name-based backstop (client / CoinGecko path)
  const name = asset.name || '';
  if (name && EXCLUDED_NAME_PATTERNS.some(re => re.test(name))) return true;

  return false;
}

/**
 * Filter a list of market-cap-ranked coins down to tradable, unpegged assets.
 * Preserves input order.
 *
 * @param {Array<{symbol: string, name?: string, tags?: string[]}>} coins
 * @returns {Array} filtered coins
 */
export function filterTradableUniverse(coins) {
  if (!Array.isArray(coins)) return [];
  return coins.filter(c => !isExcludedAsset(c));
}
