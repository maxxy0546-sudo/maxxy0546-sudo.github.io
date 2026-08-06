/**
 * LeveredETFTab.jsx — Leveraged & Inverse ETF board.
 *
 * Ported from SMB (Stable Market Board) stable/levered.py.
 * Shows 93 levered ETFs grouped by category, sorted by |1D z-score|
 * within each group. Includes a long-vs-short risk-appetite summary.
 *
 * The z-score normalizes today's return against each product's OWN
 * trailing 20-day volatility — a -9% day means nothing on a 3x product
 * without volatility normalization.
 */

import React, { useMemo, useState } from 'react';
import { LEVERED_ETFS, LEVERED_CATEGORY_ORDER } from '@/lib/board/leveredETFs';
import CopyCsvButtons from './CopyCsvButtons';
import { sortRows } from '@/lib/board/tableUtils';

function fmtPct(v, decimals = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%';
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

function fmtZ(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function zColor(v) {
  if (v == null || !Number.isFinite(v)) return 'var(--scanner-text3)';
  if (v >= 2) return 'var(--scanner-green)';
  if (v >= 1) return 'var(--scanner-text2)';
  if (v <= -2) return 'var(--scanner-red)';
  if (v <= -1) return 'var(--scanner-text2)';
  return 'var(--scanner-text3)';
}

function retColor(v) {
  if (v == null || !Number.isFinite(v)) return 'var(--scanner-text3)';
  return v > 0 ? 'var(--scanner-green)' : v < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
}

function SectionLabel({ children, right = null }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
      <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>{children}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export default function LeveredETFTab({ tradData, isLoading }) {
  const assets = tradData?.assets || [];

  // Build a lookup map: ticker → asset metrics
  const assetMap = useMemo(() => {
    const m = new Map();
    for (const a of assets) m.set(a.symbol, a);
    return m;
  }, [assets]);

  // Enrich levered ETFs with metrics from tradData
  // z1d is now computed in computeTradMetrics() using the full SMB method:
  // z = today's log-return / trailing 20D return stdev (excluding today)
  const enrichedETFs = useMemo(() => {
    return LEVERED_ETFS.map(etf => {
      const a = assetMap.get(etf.ticker);
      if (!a) return { ...etf, hasData: false, price: null, ret1d: null, ret5d: null, z1d: null, volRatio: null, distMa20: null, above20: null };
      return {
        ...etf,
        hasData: true,
        price: a.price,
        ret1d: a.ret1d,
        ret5d: a.ret5d,
        z1d: a.z1d,  // full SMB z-score from computeTradMetrics
        volRatio: a.volRatio,
        distMa20: a.distMa20,
        above20: a.above20,
      };
    });
  }, [assetMap]);

  // Sort state — per-category sort (shared across categories for simplicity)
  const [sortCol, setSortCol] = useState('z1d');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const getSortClass = (col) => {
    if (sortCol !== col) return '';
    return sortDir === 'desc' ? 'sort-desc' : 'sort-asc';
  };

  // Group by category, sorted by selected column within each group
  const grouped = useMemo(() => {
    const groups = {};
    for (const cat of LEVERED_CATEGORY_ORDER) {
      const catRows = enrichedETFs.filter(e => e.category === cat);
      groups[cat] = sortRows(catRows, e => e[sortCol] ?? (sortCol === 'z1d' ? Math.abs(e.z1d || 0) : null), sortDir);
    }
    return groups;
  }, [enrichedETFs, sortCol, sortDir]);

  // Long-vs-short risk-appetite summary
  const summary = useMemo(() => {
    const longs = enrichedETFs.filter(e => e.hasData && e.direction === 'Long' && e.z1d != null);
    const shorts = enrichedETFs.filter(e => e.hasData && e.direction === 'Short' && e.z1d != null);
    if (longs.length === 0 || shorts.length === 0) return null;
    const longAvgZ = longs.reduce((s, e) => s + e.z1d, 0) / longs.length;
    const shortAvgZ = shorts.reduce((s, e) => s + e.z1d, 0) / shorts.length;
    const longAvgRet = longs.reduce((s, e) => s + (e.ret1d || 0), 0) / longs.length;
    const shortAvgRet = shorts.reduce((s, e) => s + (e.ret1d || 0), 0) / shorts.length;
    return { longAvgZ, shortAvgZ, longAvgRet, shortAvgRet, longCount: longs.length, shortCount: shorts.length };
  }, [enrichedETFs]);

  const dataCount = enrichedETFs.filter(e => e.hasData).length;

  if (isLoading && !tradData) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-3xl mb-4 animate-pulse opacity-30">◈</div>
        <div className="text-sm mb-1" style={{ color: 'var(--scanner-text2)' }}>Loading leveraged ETF data…</div>
      </div>
    );
  }

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Risk-appetite summary */}
      {summary && (
        <div className="mb-5">
          <SectionLabel right={<span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{dataCount} of {LEVERED_ETFS.length} ETFs with data</span>}>
            Risk Appetite · Long vs Short
          </SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-green)' }}>Long ETFs ({summary.longCount})</div>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: summary.longAvgZ >= 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}>
                {fmtZ(summary.longAvgZ)}σ
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--scanner-text3)' }}>Avg 1D: {fmtPct(summary.longAvgRet)}</div>
            </div>
            <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-accent)' }}>Short ETFs ({summary.shortCount})</div>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: summary.shortAvgZ >= 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}>
                {fmtZ(summary.shortAvgZ)}σ
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--scanner-text3)' }}>Avg 1D: {fmtPct(summary.shortAvgRet)}</div>
            </div>
          </div>
          <div className="text-[8px] mt-2" style={{ color: 'var(--scanner-text3)' }}>
            Short ETFs ripping = bear flow (hedging). Long ETFs ripping = chase (risk-on).
            Z-score normalizes for each product's own volatility.
          </div>
        </div>
      )}

      {/* Category tables */}
      {LEVERED_CATEGORY_ORDER.map(cat => {
        const rows = grouped[cat];
        if (!rows || rows.length === 0) return null;
        return (
          <div key={cat} className="mb-5">
            <SectionLabel right={<CopyCsvButtons tableId={`levered-${cat.replace(/\s/g, '-').toLowerCase()}-table`} />}>
              {cat} ({rows.length})
            </SectionLabel>
            <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
              <table id={`levered-${cat.replace(/\s/g, '-').toLowerCase()}-table`} className="board-table w-full border-collapse min-w-[700px]">
                <thead>
                  <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-left ${getSortClass('ticker')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer', position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' }} onClick={() => handleSort('ticker')}>Ticker</th>
                    <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>Label</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('direction')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('direction')}>Dir</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('leverage')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('leverage')}>Lev</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('price')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('price')}>Price</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('z1d')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('z1d')}>1D Z</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('ret1d')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('ret1d')}>1D %</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('ret5d')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('ret5d')}>5D %</th>
                    <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right ${getSortClass('volRatio')}`} style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }} onClick={() => handleSort('volRatio')}>rVOL</th>
                    <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>≥20MA</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(e => (
                    <tr key={e.ticker}
                      style={{ borderBottom: '1px solid var(--scanner-border)' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                      <td className="py-1.5 px-2.5" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                        <span className="text-[11px] font-bold" style={{ color: 'var(--scanner-text)' }}>{e.ticker}</span>
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span className="text-[10px]" style={{ color: 'var(--scanner-text2)' }}>{e.label}</span>
                        <span className="text-[8px] ml-1" style={{ color: 'var(--scanner-text3)' }}>→ {e.underlying}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{
                          background: e.direction === 'Long' ? 'rgba(0,230,118,0.1)' : 'rgba(255,68,68,0.1)',
                          color: e.direction === 'Long' ? 'var(--scanner-green)' : 'var(--scanner-red)',
                        }}>{e.direction === 'Long' ? 'L' : 'S'}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{e.leverage > 0 ? '+' : ''}{e.leverage}x</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{e.hasData ? fmtPrice(e.price) : '—'}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: zColor(e.z1d) }}>{e.hasData ? fmtZ(e.z1d) : '—'}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: retColor(e.ret1d) }}>{e.hasData ? fmtPct(e.ret1d) : '—'}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: retColor(e.ret5d) }}>{e.hasData ? fmtPct(e.ret5d) : '—'}</span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: e.volRatio >= 2 ? 'var(--scanner-accent)' : 'var(--scanner-text2)' }}>
                          {e.hasData && e.volRatio != null ? e.volRatio.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        <span className="text-[10px]" style={{ color: e.above20 === 1 ? 'var(--scanner-green)' : e.above20 === 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)' }}>
                          {e.hasData ? (e.above20 === 1 ? '✓' : e.above20 === 0 ? '✗' : '—') : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
