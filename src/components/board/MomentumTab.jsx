import React, { useState, useMemo, useCallback } from 'react';
import { sortRows } from '@/lib/board/tableUtils';
import CopyCsvButtons from './CopyCsvButtons';

function fmtPct(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
}

function pctColor(v) {
  if (v == null) return 'var(--scanner-text3)';
  return v > 0 ? 'var(--scanner-green)' : v < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
}

const COLS = [
  { key: 'symbol', label: 'Ticker', sortable: true, sticky: true },
  { key: 'name', label: 'Name', sortable: false },
  { key: 'theme', label: 'Theme', sortable: false },
  { key: 'rs_btc_20d', label: 'RS 20D', sortable: true },
  { key: 'ret5d', label: '5D Ret', sortable: true },
  { key: 'ret20d', label: '20D Ret', sortable: true },
  { key: 'ret60d', label: '60D Ret', sortable: true },
  { key: 'atrExt50ma', label: 'ATR Ext', sortable: true },
  { key: 'volRatio', label: 'Vol Ratio', sortable: true },
  { key: 'distMa50', label: 'vs50MA', sortable: true },
  { key: 'tier', label: 'Tier', sortable: true },
  { key: null, label: '', sortable: false },
];

export default function MomentumTab({ cleanMomentum }) {
  const [sortCol, setSortCol] = useState('ret20d');
  /** @type {[('desc'|'asc'), function]} */
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = useCallback((key) => {
    if (!key) return;
    if (sortCol === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(key);
      setSortDir('desc');
    }
  }, [sortCol]);

  const getSortClass = useCallback((key) => {
    if (sortCol !== key) return '';
    return sortDir === 'desc' ? 'sort-desc' : 'sort-asc';
  }, [sortCol, sortDir]);

  const sortedItems = useMemo(() => {
    return sortRows(cleanMomentum || [], item => {
      if (sortCol === 'rs_btc_20d') return item.rs_btc_20d;
      return item[sortCol];
    }, sortDir);
  }, [cleanMomentum, sortCol, sortDir]);

  if (!cleanMomentum?.length) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-4xl mb-4 opacity-20">◈</div>
        <div className="text-sm" style={{ color: 'var(--scanner-text2)' }}>No assets currently meet clean momentum criteria</div>
        <div className="text-[11px] mt-2" style={{ color: 'var(--scanner-text3)' }}>Requires: above 20+50MA · positive 5D · ATR ext 1–8 · vol ratio &gt;1</div>
      </div>
    );
  }

  return (
    <div className="font-mono px-5 md:px-8 py-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
          Clean Momentum — {cleanMomentum.length} assets
        </span>
        <div className="ml-auto"><CopyCsvButtons tableId="clean-momentum-table" /></div>
      </div>

      <div className="mb-4 p-3 rounded text-[10px] leading-relaxed" style={{
        background: 'var(--scanner-bg2)',
        border: '1px solid var(--scanner-border2)',
        color: 'var(--scanner-text3)',
      }}>
        <span style={{ color: 'var(--scanner-text2)', fontWeight: 600 }}>Criteria:</span>{' '}
        Price above <span style={{ color: 'var(--scanner-accent)' }}>20MA</span> and{' '}
        <span style={{ color: 'var(--scanner-accent)' }}>50MA</span> ·{' '}
        Positive <span style={{ color: 'var(--scanner-green)' }}>5D return</span> ·{' '}
        ATR extension <span style={{ color: 'var(--scanner-accent)' }}>1.0–8.0</span> (not overextended) ·{' '}
        Volume ratio <span style={{ color: 'var(--scanner-accent)' }}>&gt;1.0</span> (above 20d avg) ·{' '}
        Ranked by <span style={{ color: 'var(--scanner-text2)' }}>relative strength vs BTC (20D)</span> ·{' '}
        Top 25 from Core/Active tier assets only.
        <span className="ml-4" style={{ color: 'var(--scanner-text3)' }}>Click column headers to sort</span>
      </div>

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
        <table id="clean-momentum-table" className="board-table w-full border-collapse min-w-[900px]">
          <thead>
            <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
              {COLS.map((col, hi) => (
                <th
                  key={col.key || hi}
                  className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left ${col.sortable ? getSortClass(col.key) : ''}`}
                  style={{
                    color: 'var(--scanner-text3)',
                    cursor: col.sortable ? 'pointer' : 'default',
                    ...(col.sticky ? { position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' } : {}),
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, i) => (
              <tr key={item.symbol}
                style={{ borderBottom: '1px solid var(--scanner-border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="py-3 px-3" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                  <span className="text-[12px] font-bold" style={{ color: 'var(--scanner-text)' }}>{item.symbol}</span>
                </td>
                <td className="py-3 px-3 text-[10px]" style={{ color: 'var(--scanner-text3)', maxWidth: 120 }}>
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</span>
                </td>
                <td className="py-3 px-3 text-[9px]" style={{ color: 'var(--scanner-text2)' }}>{item.theme}</td>
                <td className="py-3 px-3">
                  <span className="tabular-nums text-[11px] font-bold" style={{ color: pctColor(item.rs_btc_20d) }}>
                    {item.rs_btc_20d != null ? (item.rs_btc_20d >= 0 ? '+' : '') + (item.rs_btc_20d * 100).toFixed(1) + '%' : '—'}
                  </span>
                </td>
                <td className="py-3 px-3"><span className="tabular-nums text-[11px] font-semibold" style={{ color: pctColor(item.ret5d) }}>{fmtPct(item.ret5d)}</span></td>
                <td className="py-3 px-3"><span className="tabular-nums text-[11px] font-semibold" style={{ color: pctColor(item.ret20d) }}>{fmtPct(item.ret20d)}</span></td>
                <td className="py-3 px-3"><span className="tabular-nums text-[11px]" style={{ color: pctColor(item.ret60d) }}>{fmtPct(item.ret60d)}</span></td>
                <td className="py-3 px-3">
                  <span className="tabular-nums text-[11px] font-semibold" style={{ color: 'var(--scanner-accent)' }}>
                    {item.atrExt50ma != null ? item.atrExt50ma.toFixed(1) : '—'}
                  </span>
                </td>
                <td className="py-3 px-3 tabular-nums text-[11px]" style={{ color: 'var(--scanner-text2)' }}>
                  {item.volRatio != null ? item.volRatio.toFixed(2) + 'x' : '—'}
                </td>
                <td className="py-3 px-3">
                  <span className="tabular-nums text-[11px]" style={{ color: item.distMa50 != null ? (item.distMa50 > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)') : 'var(--scanner-text3)' }}>
                    {item.distMa50 != null ? (item.distMa50 >= 0 ? '+' : '') + item.distMa50.toFixed(1) + '%' : '—'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`badge ${item.tier === 'Core' ? 'tier-Core' : item.tier === 'Active' ? 'tier-Active' : 'tier-Watch'}`}>
                    {item.tier}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="badge" style={{ background: 'rgba(0,230,118,0.08)', color: 'var(--scanner-green)', border: '1px solid rgba(0,230,118,0.2)' }}>CLEAN</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
