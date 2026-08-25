import React from 'react';

function indicatorLabel(type, emaVal, vwapVal) {
  return type === 'vwap' ? `VWAP(${vwapVal}d)` : `EMA(${emaVal})`;
}

// Audit F-14-e-12 (2026-08-26): expanded to match ScannerHeader.jsx's full
// map. Previously only had 4 entries; for okx_perps (the default!),
// hyperliquid, bybit, coingecko, auto, snapshot — fell through to raw
// uppercase IDs, inconsistent with ScannerHeader's friendly names.
const EXCHANGE_NAMES = {
  okx_perps: 'OKX Perps',
  okx: 'OKX Spot',
  kraken: 'Kraken',
  binance: 'Binance Spot',
  binance_perps: 'Binance Perps',
  hyperliquid: 'Hyperliquid',
  bybit: 'Bybit',
  coingecko: 'CoinGecko',
  auto: 'Auto (Binance→OKX→Snapshot)',
  snapshot: 'Snapshot (Daily)',
};

export default function StatusBar({ settings }) {
  const fastLabel = indicatorLabel(settings.fastType, settings.emaFast, settings.vwapFastDays);
  const midLabel  = indicatorLabel(settings.midType,  settings.emaMid,  settings.vwapMidDays);
  const slowLabel = indicatorLabel(settings.slowType, settings.emaSlow, settings.vwapDays);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 font-mono flex items-center justify-between px-5 md:px-8 py-2 text-[9px] tracking-wider" style={{
      background: 'var(--scanner-bg1)',
      borderTop: '1px solid var(--scanner-border2)',
      color: 'var(--scanner-text3)'
    }}>
      <div className="flex gap-5 flex-wrap">
        <span>{EXCHANGE_NAMES[settings.exchange] || settings.exchange.toUpperCase()}</span>
        <span>Top 500 · {settings.timeframe || '4H'}</span>
        <span className="hidden sm:inline">
          Price &gt; {slowLabel} · Fast {fastLabel} &gt; Mid {midLabel}
        </span>
        {settings.chainFilter && settings.chainFilter !== 'All' && (
          <span style={{ color: 'var(--scanner-accent)' }}>Chain: {settings.chainFilter}</span>
        )}
        {settings.sectorFilter && settings.sectorFilter !== 'All' && (
          <span style={{ color: 'var(--scanner-accent)' }}>Sector: {settings.sectorFilter}</span>
        )}
      </div>
      <div className="flex gap-5">
        <span className="hidden md:inline">rVol {settings.rVolPeriod || 20}</span>
        <span className="hidden md:inline">ATR {settings.atrPeriod || 14}</span>
        <span>Scanned {settings.scannedCount ?? 0}/{settings.totalCount ?? 0}</span>
        <span style={{ color: settings.matchedCount > 0 ? 'var(--scanner-accent)' : 'var(--scanner-text3)' }}>
          Matched {settings.matchedCount ?? 0}
        </span>
      </div>
    </div>
  );
}
