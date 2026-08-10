export const STABLECOINS = new Set([
  // Major USD stablecoins
  'USDT','USDC','BUSD','DAI','TUSD','USDP','GUSD','FRAX','LUSD',
  'SUSD','USDD','USTC','FDUSD','PYUSD','CRVUSD','USDX','USDS',
  'USDE','USDJ','HUSD','DOLA','MIM','ALUSD','OUSD','USDK','USDI',
  'CUSD','GHO','USDB','USDL','USDZ','LISUSD',
  // Newer USD stablecoins (2024-2026)
  'RLUSD','USDG','USD1','USDS','USYS','USDM','USDY','USDV','USDR',
  'USDF','USDO','USDA','USDB','USDT0','USDX','USC','USDTL','USDPY',
  'WUSD','YUSD','AUSD','BUSD','DUSD','EUSD','FUSD','GUSD','IUSD',
  'JUSD','KUSD','LUSD','MUSD','NUSD','OUSD','PUSD','QUSD','RUSD',
  'SUSD','TUSD','UUSD','VUSD','WUSD','XUSD','YUSD','ZUSD',
  // EUR-pegged (also stable, not relevant for scanner)
  'EURC','EUROC','EURT','CEUR','AGEUR','EURS','SEUR','STEUR','EURA',
  // Other fiat-pegged
  'XSGD','EURS','TRYB','BIDR','BKRW','BVND','BGBP','BCAD','BRZ',
  'NZDS','GBPT','CADC','JPYC','CCXX','UAE',
  // Algorithmic / failed stablecoins (keep filtered)
  'USTC','UST','MIM','FRAX',
  // Tokenized fiat
  'EURT','TRYB','XCHF','CBEUR','CBJPY','CBGBP','NZDS',
  // Yield-bearing / RWA-backed stablecoins
  'USDY','USDM','USDV','USDR','sUSDe','sUSDS','wUSDM','USD0','USD0++',
  'USAT','USDG','RLUSD','USD1','USD0','USDC.e','USDD',
  'USDR','USDA','USDF','sFRAX',
]);

export const WRAPPED = new Set([
  'WBTC','WETH','WBNB','WSOL','STETH','WSTETH','CBETH','WBETH','RETH',
  'FRXETH','SFRXETH','WEETH','EZETH','RSETH','PXETH','WMATIC',
  'WAVAX','WFTM','WONE','WKLAY','WROSE',
  // Wrapped/staked BTC variants
  'TBTC','WBTC.E','CBBTC','LBTC','BBTC','HBTC','PBTC','TBTCV2',
  // Wrapped/staked ETH variants
  'BETH','METH','LSETH','WSTETH','SWETH','ANKRETH','RETH2',
  // Liquid staking derivatives (staked versions of assets)
  'BNSOL','JITOSOL','MSOL','STSOL','JUPSOL','BBLSTSOL',
  // Other tokenized/wrapped assets that shouldn't appear in scanner
  'FIDD',
]);

// CMC tag slugs that mark non-tradeable-as-crypto assets: tokenized equities
// and Binance xStocks. These slip into CMC's top-500 when
// "cryptocurrency_type=all" is used (e.g. NVDAON, NVDAX, TSLAX, SPYX, etc.)
// and should be filtered out of the crypto Screener universe — they're not
// crypto, they're tokenized TradFi.
//
// NOTE: NOT included (intentionally):
//   - `tokenized-assets` (too broad — also catches XAUT/PAXG tokenized gold,
//     which are popular crypto-adjacent tradeable assets)
//   - `tokenized-commodities` (XAUT, PAXG, XAUM — gold tokens, tradeable)
//   - `synthetics` / `synthetic-protocols` (these are PROTOCOL tags, not
//     asset tags — they filter out SNX/Synthetix which is a legit DeFi token)
export const TOKENIZED_TAGS = new Set([
  'tokenized-stock',       // NVDAON, TSLAX, MSTRX, MUON, CRCLX, etc.
  'tokenized-etfs',        // SPYX, IVVON, SPYON, IBITON
  'xstocks-ecosystem',     // Binance xStocks (NVDAX, TSLAX, AAPLX, etc.)
  'bstocks',               // Backed stocks (bNVDA, bTSLA, MUB, SNDKB, etc.)
]);

// Name keywords that mark non-crypto / wrapped / tokenized assets. Used as a
// heuristic for live fallback sources (CoinCap, Binance 24hr ticker) that
// don't supply CMC tags. Matches case-insensitively against the asset name.
export const NON_CRYPTO_NAME_KEYWORDS = [
  'tokenized stock',
  'tokenized equity',
  'xstock',           // e.g. "NVIDIA xStock"
  'wrapped beacon',   // WBETH (Wrapped Beacon ETH)
  'wrapped eth',      // catch-all for future W-eth variants
  'synthetic',        // e.g. "Synthetic NVIDIA"
  'backed stock',     // e.g. "Backed NVIDIA Stock"
];
