import React, { useState, useCallback, useMemo } from 'react';
import { fmtPrice, fmtPct } from '@/lib/scanner/calculations';
import { toTradingViewSymbol } from '@/lib/scanner/tradingViewSymbols';
import { tableToCsv, downloadCsv } from '@/lib/board/tableUtils';

function fmtChange(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function fmtVolume(v) {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function fmtMarketCap(v) {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

function fmtFunding(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  // Funding rate is typically a small decimal (0.0001 = 0.01%)
  // Display as basis points (bps): 0.0001 → 1.0bps, or as % with 4 decimals
  const pct = v * 100;
  return (v >= 0 ? '+' : '') + pct.toFixed(4) + '%';
}

function fmtOI(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return '—';
  // Open interest in USD
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

// Format OI in coin terms (e.g. "33.0K BTC", "1.2M ETH")
function fmtOICoin(v, symbol) {
  if (v == null || !Number.isFinite(v) || v === 0) return '—';
  const sym = symbol || '';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B ' + sym;
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M ' + sym;
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K ' + sym;
  return v.toFixed(0) + ' ' + sym;
}

function fmtRVol(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  // rVol = ratio (1.0 = average). Display as "2.3x" or "0.8x"
  return v.toFixed(2) + 'x';
}

function fmtRSI(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(1);
}

function indicatorLabel(type, emaVal, vwapVal) {
  return type === 'vwap' ? `VWAP(${vwapVal}d)` : `EMA(${emaVal})`;
}

function MiniSparkline({ data, positive }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--scanner-text3)' }}>—</span>;

  const w = 80, h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const color = positive == null
    ? 'var(--scanner-text3)'
    : positive
    ? 'var(--scanner-green)'
    : 'var(--scanner-red)';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ display: 'block' }}>
      <polyline
        points={pts.join(' ')}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
    </svg>
  );
}

const SORTABLE_COLS = [
  'rank', 'symbol', 'price', 'change1h', 'change24h', 'volume24h', 'rVol',
  'rsi', 'marketCap', 'fundingRate', 'openInterest', 'oiRatio', 'pricePct', 'emaPct',
];

export default function ResultsTable({ results, settings, isScanning, onSelectRow, hasScanned }) {
  const [sortKey, setSortKey] = useState('rank');
  /** @type {[('desc'|'asc'), function]} */
  const [sortDir, setSortDir] = useState('desc');
  const [copied, setCopied] = useState(null);
  const [csvDone, setCsvDone] = useState(false);
  const tableRef = useCallback(() => document.getElementById('scanner-results-table'), []);

  const handleCopy = useCallback((format) => {
    if (!results.length) return;
    let text;
    if (format === 'tv') {
      text = results.map(r => toTradingViewSymbol(r.symbol, settings.exchange)).join(', ');
    } else {
      text = results.map(r => r.symbol).join(', ');
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    });
  }, [results, settings.exchange]);

  const handleCsv = useCallback(() => {
    const tbl = document.getElementById('scanner-results-table');
    if (!tbl) return;
    const csv = tableToCsv(/** @type {HTMLTableElement} */ (tbl));
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`scanner_results_${date}.csv`, csv);
    setCsvDone(true);
    setTimeout(() => setCsvDone(false), 2000);
  }, []);

  const handleSort = useCallback((key) => {
    if (!key || !SORTABLE_COLS.includes(key)) return;
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const getSortClass = useCallback((key) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? 'sort-desc' : 'sort-asc';
  }, [sortKey, sortDir]);

  const sorted = useMemo(() => {
    const arr = [...results];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [results, sortKey, sortDir]);

  const maxPricePct = Math.max(...sorted.map(r => r.pricePct), 1);
  const maxEmaPct = Math.max(...sorted.map(r => r.emaPct), 1);

  const fastLabel = indicatorLabel(settings.fastType, settings.emaFast, settings.vwapFastDays);
  const midLabel = indicatorLabel(settings.midType, settings.emaMid, settings.vwapMidDays);
  const slowLabel = indicatorLabel(settings.slowType, settings.emaSlow, settings.vwapDays);
  const isTradFi = settings.mode === 'tradfi';

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-bold leading-none" style={{
              color: results.length > 0 ? 'var(--scanner-green)' : 'var(--scanner-text3)'
            }}>
              {results.length || '0'}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--scanner-text2)' }}>
              assets matched
            </span>
          </div>

          {/* Copy + CSV buttons — only show when there are results */}
          {results.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                className="font-mono text-[9px] font-semibold tracking-[0.08em] px-2.5 py-1.5 rounded transition-all"
                style={{
                  background: copied === 'tv' ? 'rgba(0,230,118,0.12)' : 'var(--scanner-bg2)',
                  border: `1px solid ${copied === 'tv' ? 'var(--scanner-green)' : 'var(--scanner-border2)'}`,
                  color: copied === 'tv' ? 'var(--scanner-green)' : 'var(--scanner-text3)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => handleCopy('tv')}
                title="Copy as TradingView symbols"
              >
                {copied === 'tv' ? '✓ Copied' : '⧉ Copy TV'}
              </button>
              <button
                className="font-mono text-[9px] font-semibold tracking-[0.08em] px-2.5 py-1.5 rounded transition-all"
                style={{
                  background: copied === 'tickers' ? 'rgba(0,230,118,0.12)' : 'var(--scanner-bg2)',
                  border: `1px solid ${copied === 'tickers' ? 'var(--scanner-green)' : 'var(--scanner-border2)'}`,
                  color: copied === 'tickers' ? 'var(--scanner-green)' : 'var(--scanner-text3)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => handleCopy('tickers')}
                title="Copy bare tickers"
              >
                {copied === 'tickers' ? '✓ Copied' : '⧉ Tickers'}
              </button>
              <button
                className="font-mono text-[9px] font-semibold tracking-[0.08em] px-2.5 py-1.5 rounded transition-all"
                style={{
                  background: csvDone ? 'rgba(0,230,118,0.12)' : 'var(--scanner-bg2)',
                  border: `1px solid ${csvDone ? 'var(--scanner-green)' : 'var(--scanner-border2)'}`,
                  color: csvDone ? 'var(--scanner-green)' : 'var(--scanner-text3)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={handleCsv}
                title="Download results as CSV"
              >
                {csvDone ? '✓ Downloaded' : '⬇ CSV'}
              </button>
            </div>
          )}
        </div>

        <span className="text-[9px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
          Click column headers to sort
        </span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState isScanning={isScanning} hasScanned={hasScanned} />
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--scanner-border2)' }}>
          <table id="scanner-results-table" className={`board-table w-full border-collapse ${isTradFi ? 'min-w-[900px]' : 'min-w-[1300px]'}`}>
            <thead>
              <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                {[
                  { key: null, label: '' },
                  { key: 'symbol', label: 'Asset' },
                  { key: 'price', label: 'Price', right: true },
                  { key: null, label: '7D', right: true },
                  { key: 'change1h', label: '1h Δ', right: true, cryptoOnly: true },
                  { key: 'change24h', label: '24h Δ', right: true },
                  { key: 'volume24h', label: 'VOL', right: true, cryptoOnly: true },
                  { key: 'rVol', label: 'rVOL', right: true },
                  { key: 'rsi', label: 'RSI', right: true },
                  { key: 'marketCap', label: 'MCAP', right: true, cryptoOnly: true },
                  { key: 'fundingRate', label: 'FUND', right: true, cryptoOnly: true },
                  { key: 'openInterest', label: 'OI', right: true, cryptoOnly: true },
                  { key: 'oiRatio', label: 'OI/MC', right: true, cryptoOnly: true },
                  { key: 'pricePct', label: 'Δ Base', right: true },
                  { key: 'emaPct', label: 'Δ Spread', right: true },
                  { key: null, label: fastLabel, right: true },
                  { key: null, label: midLabel, right: true },
                  { key: null, label: slowLabel, right: true },
                ].filter(col => !isTradFi || !col.cryptoOnly).map((col, i) => (
                  <th
                    key={i}
                    className={`text-[8.5px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap py-2 px-2.5 ${col.right ? 'text-right' : 'text-left'} ${col.key ? getSortClass(col.key) : ''}`}
                    style={{
                      color: 'var(--scanner-text3)',
                      cursor: col.key ? 'pointer' : 'default',
                      ...(i <= 1 ? { position: 'sticky', left: i === 0 ? 0 : '32px', zIndex: 10, background: 'var(--scanner-bg2)' } : {}),
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <ResultRow
                  key={r.symbol}
                  row={r}
                  index={i}
                  maxPricePct={maxPricePct}
                  maxEmaPct={maxEmaPct}
                  onSelectRow={onSelectRow}
                  isTradFi={isTradFi}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.row - result row data
 * @param {number} props.index - row index (for animation delay)
 * @param {number} props.maxPricePct - max pricePct across all rows (for bar width)
 * @param {number} props.maxEmaPct - max emaPct across all rows (for bar width)
 * @param {function} [props.onSelectRow] - callback when row is clicked
 * @param {boolean} [props.isTradFi] - true if in TradFi mode (hides crypto-only columns)
 */
function ResultRow({ row, index, maxPricePct, maxEmaPct, onSelectRow, isTradFi }) {
  const pBarW = Math.max(2, Math.round((row.pricePct / maxPricePct) * 40));
  const eBarW = Math.max(2, Math.round((row.emaPct / maxEmaPct) * 40));
  const isPositive = row.change24h != null ? row.change24h >= 0 : null;

  return (
    <tr
      onClick={() => onSelectRow?.(row)}
      style={{
        borderBottom: '1px solid var(--scanner-border)',
        animation: `rowIn 0.18s ease forwards`,
        animationDelay: `${Math.min(index * 0.015, 0.35)}s`,
        opacity: 0,
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Chart button — opens TradingView chart in side panel (sticky left) */}
      <td className="py-2 px-1.5 text-center" style={{ width: '32px', position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectRow?.(row);
          }}
          title={`View ${row.symbol} chart`}
          style={{
            background: 'transparent',
            border: '1px solid var(--scanner-border2)',
            borderRadius: '4px',
            width: '24px',
            height: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s',
            color: 'var(--scanner-text3)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--scanner-accent)';
            e.currentTarget.style.background = 'rgba(245,158,11,0.08)';
            e.currentTarget.style.color = 'var(--scanner-accent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--scanner-border2)';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--scanner-text3)';
          }}
        >
          {/* Chart/candlestick icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
            <rect x="2" y="5" width="2.5" height="6" rx="0.5" fill="currentColor" opacity="0.7" />
            <line x1="3.25" y1="3" x2="3.25" y2="5" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
            <line x1="3.25" y1="11" x2="3.25" y2="13" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
            <rect x="6.75" y="3" width="2.5" height="9" rx="0.5" fill="currentColor" />
            <line x1="8" y1="1.5" x2="8" y2="3" stroke="currentColor" strokeWidth="0.75" />
            <line x1="8" y1="12" x2="8" y2="14.5" stroke="currentColor" strokeWidth="0.75" />
            <rect x="11.5" y="6" width="2.5" height="5" rx="0.5" fill="currentColor" opacity="0.5" />
            <line x1="12.75" y1="4" x2="12.75" y2="6" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
            <line x1="12.75" y1="11" x2="12.75" y2="13" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
          </svg>
        </button>
      </td>

      {/* Asset (sticky left, second column) */}
      <td className="py-2 px-2.5" style={{ position: 'sticky', left: '32px', zIndex: 5, background: 'var(--scanner-bg1)' }}>
        <div className="text-[11px] font-bold leading-tight" style={{ color: 'var(--scanner-text)' }}>{row.symbol}</div>
        <div className="text-[9px] leading-tight max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--scanner-text3)' }}>{row.name}</div>
        {(isTradFi ? row.category : row.platform) && (
          <div className="text-[7px] leading-tight mt-0.5" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>
            {isTradFi ? row.category : row.platform}
          </div>
        )}
      </td>

      {/* Price */}
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--scanner-text)' }}>{fmtPrice(row.price)}</span>
      </td>

      {/* 7D Sparkline */}
      <td className="py-2 px-2.5 text-right">
        <MiniSparkline data={row.sparkline} positive={isPositive} />
      </td>

      {/* Phase 1c — 1h Change (from CMC) — crypto only */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums min-w-[42px] text-right" style={{
          color: row.change1h == null ? 'var(--scanner-text3)' :
                 row.change1h >= 0 ? 'var(--scanner-green)' : 'var(--scanner-red)'
        }}>
          {fmtChange(row.change1h)}
        </span>
      </td>
      )}

      {/* 24h Change */}
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums min-w-[52px] text-right" style={{
          color: isPositive == null ? 'var(--scanner-text3)' : isPositive ? 'var(--scanner-green)' : 'var(--scanner-red)'
        }}>
          {fmtChange(row.change24h)}
        </span>
      </td>

      {/* VOL 24H — crypto only (tradfi has no CMC volume in v1) */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--scanner-text2)' }}>
          {row.volume24h > 0 ? fmtVolume(row.volume24h) : '—'}
        </span>
      </td>
      )}

      {/* RELATIVE VOLUME (rVol = current / 20d SMA) */}
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{
          color: row.rVol == null ? 'var(--scanner-text3)' :
                 row.rVol >= 2 ? 'var(--scanner-accent)' :
                 row.rVol >= 1.5 ? 'var(--scanner-green)' :
                 row.rVol < 0.5 ? 'var(--scanner-text3)' : 'var(--scanner-text2)'
        }}>
          {fmtRVol(row.rVol)}
        </span>
      </td>

      {/* RSI (14) — only computed when rsiEnabled is true; otherwise shows — */}
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{
          color: row.rsi == null ? 'var(--scanner-text3)' :
                 row.rsi < 30 ? 'var(--scanner-green)' :   /* oversold = green (buy signal) */
                 row.rsi > 70 ? 'var(--scanner-red)' :      /* overbought = red (sell signal) */
                 'var(--scanner-text2)'
        }}>
          {fmtRSI(row.rsi)}
        </span>
      </td>

      {/* MKTCAP — crypto only (no tradfi fundamentals in v1) */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--scanner-text2)' }}>
          {row.marketCap > 0 ? fmtMarketCap(row.marketCap) : '—'}
        </span>
      </td>
      )}

      {/* FUNDING RATE (user-selected exchange — HL/OKX/Bybit/Binance perps; null for spot exchanges) — crypto only */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right" title={row.fundingRate == null ? 'No funding rate available (selected exchange is spot-only, or symbol not listed on selected exchange perp market)' : 'Funding rate from selected exchange. Positive (green) = longs pay shorts. Negative (red) = shorts pay longs.'}>
        <span className="text-[11px] font-semibold tabular-nums" style={{
          color: row.fundingRate == null ? 'var(--scanner-text3)' :
                 row.fundingRate > 0 ? 'var(--scanner-green)' :
                 row.fundingRate < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)'
        }}>
          {fmtFunding(row.fundingRate)}
        </span>
      </td>
      )}

      {/* OPEN INTEREST in coin terms (6-exchange aggregated) — crypto only */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--scanner-text2)' }}>
          {fmtOICoin(row.openInterestRaw, row.symbol)}
        </span>
      </td>
      )}

      {/* OI/MC RATIO (OI in USD / MarketCap) — crypto only */}
      {!isTradFi && (
      <td className="py-2 px-2.5 text-right">
        <span
          className="text-[11px] font-semibold tabular-nums cursor-help"
          style={{
            color: row.oiRatio == null ? 'var(--scanner-text3)' :
                   row.oiRatio >= 0.30 ? 'var(--scanner-red)' :     // >30% of mcap in OI = extreme
                   row.oiRatio >= 0.15 ? 'var(--scanner-accent)' :  // >15% = elevated
                   row.oiRatio >= 0.05 ? 'var(--scanner-text2)' :   // 5-15% = normal
                   'var(--scanner-text3)'                            // <5% = low
          }}
          title={row.oiRatio != null
            ? `OI/MC: ${(row.oiRatio * 100).toFixed(1)}% of market cap in open interest (6-exchange aggregated: HL + OKX + Bybit + Bitget + Gate + Binance${row.oiSources ? `, ${row.oiSources} source${row.oiSources === 1 ? '' : 's'}` : ''}). High ratio = crowded positioning relative to asset size. >30% = extreme (squeeze risk). <5% = low positioning.`
            : 'OI/MC unavailable (no perp OI exists for this symbol on any of the 6 exchanges, or market cap missing)'}
        >
          {row.oiRatio != null ? `${(row.oiRatio * 100).toFixed(1)}%` : '—'}
        </span>
      </td>
      )}

      {/* Δ Base Trend */}
      <td className="py-2 px-2.5 text-right">
        <PctBarCell value={row.pricePct} barWidth={pBarW} color="var(--scanner-base)" />
      </td>

      {/* Δ Spread */}
      <td className="py-2 px-2.5 text-right">
        <PctBarCell value={row.emaPct} barWidth={eBarW} color="var(--scanner-fast)" />
      </td>

      {/* Fast EMA/VWAP */}
      <td className="py-2 px-2.5 text-right text-[11px] tabular-nums" style={{ color: 'var(--scanner-fast)' }}>{fmtPrice(row.emaFast)}</td>

      {/* Mid EMA/VWAP */}
      <td className="py-2 px-2.5 text-right text-[11px] tabular-nums" style={{ color: 'var(--scanner-slow)' }}>{fmtPrice(row.emaMid)}</td>

      {/* Base (slow) */}
      <td className="py-2 px-2.5 text-right text-[11px] tabular-nums" style={{ color: 'var(--scanner-base)' }}>{fmtPrice(row.emaSlow)}</td>
    </tr>
  );
}

function PctBarCell({ value, barWidth, color }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-10 h-[3px] rounded-full overflow-hidden flex-shrink-0" style={{ background: 'var(--scanner-border2)' }}>
        <div className="h-full rounded-full" style={{ background: color, width: `${barWidth}px`, minWidth: '2px' }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{fmtPct(value)}</span>
    </div>
  );
}

function EmptyState({ isScanning, hasScanned }) {
  // Three states:
  // 1. Never scanned (hasScanned=false, isScanning=false) → welcome message
  // 2. Currently scanning (isScanning=true) → scanning message
  // 3. Scanned but no results (hasScanned=true, isScanning=false) → no matches + rate-limit hint
  const isWelcome = !isScanning && !hasScanned;

  return (
    <div className="text-center py-20 rounded-lg" style={{ border: '1px solid var(--scanner-border2)', background: 'var(--scanner-bg1)' }}>
      <div className={`text-4xl mb-4 ${isScanning ? 'animate-pulse' : ''}`} style={{ opacity: 0.3 }}>◈</div>
      <div className="text-sm font-medium mb-1.5" style={{ color: 'var(--scanner-text2)' }}>
        {isScanning ? 'Scanning markets…' : isWelcome ? 'Welcome to TrendScan' : 'No assets matched all conditions'}
      </div>
      <div className="text-[11px] mb-2" style={{ color: 'var(--scanner-text3)' }}>
        {isScanning
          ? 'Results will appear as matches are found'
          : isWelcome
          ? 'Press SCAN to analyze the crypto universe across 8+ exchanges'
          : 'Try adjusting indicator periods or selecting a different exchange'}
      </div>
      {!isScanning && !isWelcome && (
        <div className="text-[10px] px-4 py-2 mx-auto max-w-md rounded" style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          color: 'var(--scanner-accent)',
        }}>
          Fetches can fail because of rate limiting. Please scan again or reload the page.
        </div>
      )}
    </div>
  );
}