import React from 'react';
import { TRAD_UNIVERSE } from '@/lib/board/traditionalMarkets';

// Compute once at module load — TRAD_UNIVERSE is a static constant.
const TRAD_UNIVERSE_COUNT = TRAD_UNIVERSE.length;

function indicatorLabel(type, emaVal, vwapVal) {
  return type === 'vwap' ? `VWAP(${vwapVal}d)` : `EMA(${emaVal})`;
}

const EXCHANGE_NAMES = {
  okx_perps: 'OKX Perps',
  okx: 'OKX Spot',
  kraken: 'Kraken',
  binance: 'Binance Spot',
  binance_perps: 'Binance Perps',
  hyperliquid: 'Hyperliquid',
  bybit: 'Bybit',
  coingecko: 'CoinGecko',
  // TradFi mode sources
  auto: 'Auto (Binance→OKX→Snapshot)',
  snapshot: 'Snapshot (Daily)',
};

function fmtVol(v) {
  if (!v || v <= 0) return null;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

export default function ScannerHeader({ settings, scanMeta, onModeChange }) {
  const fastLabel = indicatorLabel(settings.fastType, settings.emaFast, settings.vwapFastDays);
  const midLabel  = indicatorLabel(settings.midType,  settings.emaMid,  settings.vwapMidDays);
  const slowLabel = indicatorLabel(settings.slowType, settings.emaSlow, settings.vwapDays);
  const mode = settings.mode || 'crypto';
  const isTradFi = mode === 'tradfi';

  return (
    <div className="font-mono" style={{
      background: 'linear-gradient(180deg, #0a0d14 0%, var(--scanner-bg1) 100%)',
      borderBottom: '1px solid var(--scanner-border2)'
    }}>
      <div className="flex items-start justify-between gap-6 px-5 md:px-8 pt-5 pb-4 flex-wrap">
        <div>
          {/* Title + Mode Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight leading-none" style={{ color: 'var(--scanner-text)' }}>
              Trend{' '}
              <span style={{
                background: 'linear-gradient(90deg, var(--scanner-accent), #ffcc44)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>{isTradFi ? 'TradFi' : 'Crypto'}</span>{' '}
              Screener
            </h1>

            {/* Mode toggle — segmented control */}
            {onModeChange && (
              <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--scanner-border2)' }}>
                <button
                  onClick={() => onModeChange('crypto')}
                  className="px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] uppercase transition-colors"
                  style={{
                    background: !isTradFi ? 'var(--scanner-accent)' : 'var(--scanner-bg2)',
                    color: !isTradFi ? '#0a0d14' : 'var(--scanner-text3)',
                  }}
                >Crypto</button>
                <button
                  onClick={() => onModeChange('tradfi')}
                  className="px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] uppercase transition-colors"
                  style={{
                    background: isTradFi ? 'var(--scanner-accent)' : 'var(--scanner-bg2)',
                    color: isTradFi ? '#0a0d14' : 'var(--scanner-text3)',
                  }}
                >TradFi</button>
              </div>
            )}
          </div>

          {/* Short description */}
          <p className="mt-2 text-[10px] leading-relaxed max-w-lg" style={{ color: 'var(--scanner-text3)' }}>
            {isTradFi
              ? `Identify high-momentum tradfi tickers across ${TRAD_UNIVERSE_COUNT} stocks, ETFs, commodities, and indices.`
              : 'Identify high-momentum assets across the top 500 market cap pairs.'}
          </p>
          <p className="mt-1 text-[10px] leading-relaxed max-w-lg" style={{ color: 'var(--scanner-text3)' }}>
            Returns assets satisfying: <span style={{ color: 'var(--scanner-text2)' }}>Price &gt; Base Trend</span> AND <span style={{ color: 'var(--scanner-text2)' }}>Fast MA &gt; Slow MA</span>.
            Fully customizable by timeframe, calculation type, moving average lengths, and optional
            <span style={{ color: 'var(--scanner-text2)' }}> 24H volume</span>{isTradFi ? '' : ' and'}
            <span style={{ color: 'var(--scanner-text2)' }}>{isTradFi ? '' : ' market cap'}</span> filters to screen out illiquid{isTradFi ? '' : ' or micro-cap'} assets.
          </p>

          {/* Current Scan Settings label */}
          <div className="mt-3 mb-1 text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-accent)', textDecoration: 'underline' }}>
            Current Scan Settings
          </div>

          {/* Live condition summary — each item on its own line */}
          <div className="flex flex-col gap-1 text-[10px]" style={{ color: 'var(--scanner-text2)' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-text3)' }} />
              <span>Price above</span>
              <CondBadge color="var(--scanner-base)">{slowLabel}</CondBadge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-text3)' }} />
              <span>Fast {fastLabel}</span>
              <span style={{ color: 'var(--scanner-text3)' }}>above</span>
              <CondBadge color="var(--scanner-slow)">Mid {midLabel}</CondBadge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-text3)' }} />
              <span>Timeframe</span>
              <CondBadge color="var(--scanner-accent)">{settings.timeframe || '4H'}</CondBadge>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-text3)' }} />
              <span>Universe</span>
              <CondBadge color="var(--scanner-text2)">{isTradFi ? `${TRAD_UNIVERSE_COUNT} TradFi` : 'Top 500'}</CondBadge>
            </div>
            {settings.minVolume > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-accent)' }} />
                <span>Min Vol 24H</span>
                <CondBadge color="var(--scanner-accent)">{fmtVol(settings.minVolume)}</CondBadge>
              </div>
            )}
            {!isTradFi && settings.minMarketCap > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--scanner-accent)' }} />
                <span>Min MCap</span>
                <CondBadge color="var(--scanner-accent)">{fmtVol(settings.minMarketCap)}</CondBadge>
              </div>
            )}
          </div>
        </div>

        {/* Right meta */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <MetaChip label="Source" value={EXCHANGE_NAMES[settings.exchange] || settings.exchange.toUpperCase()} />
          <MetaChip label="Updated"  value={scanMeta.updatedAt || '—'} />
          <MetaChip label="Duration" value={scanMeta.duration ? `${scanMeta.duration}s` : '—'} />
        </div>
      </div>
    </div>
  );
}

function CondBadge({ children, color }) {
  return (
    <span className="px-1.5 py-0.5 font-semibold text-[9.5px]" style={{
      background: `${color}15`,
      color,
      border: `1px solid ${color}35`
    }}>
      {children}
    </span>
  );
}

function MetaChip({ label, value }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[8px] font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
        {label}
      </span>
      <span className="text-[11px] font-medium" style={{ color: 'var(--scanner-text2)' }}>
        {value}
      </span>
    </div>
  );
}
