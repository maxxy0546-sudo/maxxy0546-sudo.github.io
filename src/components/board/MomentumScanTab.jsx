import React, { useState, useMemo, useCallback } from 'react';
import { sortRows } from '@/lib/board/tableUtils';
import CopyCsvButtons from './CopyCsvButtons';

function fmtPct(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function retColor(v) {
  if (v == null) return 'var(--scanner-text3)';
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

// Column definitions for sortability
const COLUMNS = [
  { key: 'rank', label: '#', sortable: true },
  { key: 'symbol', label: 'Ticker', sortable: true },
  { key: 'name', label: 'Name', sortable: false },
  { key: 'subtheme', label: 'Subtheme', sortable: false },
  { key: 'ret1d', label: '1D', sortable: true },
  { key: '_abs', label: 'Abs', sortable: true },   // dynamic — bound at render time
  { key: '_rel', label: 'Rel', sortable: true },   // dynamic — bound at render time
  { key: 'distMa50', label: 'vs50MA', sortable: true },
  { key: 'atrExt50ma', label: 'ATR Ext', sortable: true },
  { key: 'volRatio', label: 'Vol Ratio', sortable: true },
  { key: 'tier', label: 'Tier', sortable: true },
];

/**
 * @param {object} props
 * @param {Array} props.items
 * @param {string} props.absKey
 * @param {string} props.relKey
 */
function MomentumTable({ items, absKey, relKey }) {
  const [sortCol, setSortCol] = useState('_abs');
  const [sortDir, setSortDir] = useState(/** @type {'desc' | 'asc'} */ ('desc'));

  const handleSort = useCallback((col) => {
    const actualKey = col === '_abs' ? absKey : col === '_rel' ? relKey : col;
    if (!actualKey) return;
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }, [absKey, relKey, sortCol]);

  const getSortClass = useCallback((col) => {
    return sortCol === col ? (sortDir === 'desc' ? 'sort-desc' : 'sort-asc') : '';
  }, [sortCol, sortDir]);

  const sorted = useMemo(() => {
    const actualKey = sortCol === '_abs' ? absKey : sortCol === '_rel' ? relKey : sortCol;
    return sortRows(items, item => item[actualKey], sortDir);
  }, [items, sortCol, sortDir, absKey, relKey]);

  if (!items?.length) {
    return (
      <div className="text-center py-8 text-[11px]" style={{ color: 'var(--scanner-text3)', border: '1px solid var(--scanner-border2)' }}>
        No assets in this window
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
      <table id="momentum-scan-table" className="board-table w-full border-collapse min-w-[1000px]">
        <thead>
          <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
            {COLUMNS.map((col, hi) => (
              <th
                key={col.key}
                className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left ${col.sortable ? getSortClass(col.key) : ''}`}
                style={{
                  color: 'var(--scanner-text3)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  ...(hi === 0 ? { position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' } : {}),
                  ...(hi === 1 ? { position: 'sticky', left: '32px', zIndex: 10, background: 'var(--scanner-bg2)' } : {}),
                }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.key === '_abs' ? `Abs` : col.key === '_rel' ? `Rel` : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr key={item.symbol + i}
              style={{ borderBottom: '1px solid var(--scanner-border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td className="py-2.5 px-3 text-[10px]" style={{ color: 'var(--scanner-text3)', position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>{item.rank}</td>
              <td className="py-2.5 px-3" style={{ position: 'sticky', left: '32px', zIndex: 5, background: 'var(--scanner-bg1)' }}>
                <span className="text-[12px] font-bold" style={{ color: 'var(--scanner-text)' }}>{item.symbol}</span>
              </td>
              <td className="py-2.5 px-3 text-[10px] max-w-[120px]">
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--scanner-text3)' }}>{item.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[9px]" style={{ color: 'var(--scanner-text2)' }}>{item.subtheme}</td>
              <td className="py-2.5 px-3">
                <span className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(item.ret1d) }}>
                  {fmtPct(item.ret1d != null ? item.ret1d * 100 : null)}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className="tabular-nums text-[11px] font-bold" style={{ color: retColor(item[absKey]) }}>
                  {fmtPct(item[absKey])}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className="tabular-nums text-[11px]" style={{ color: retColor(item[relKey]) }}>
                  {fmtPct(item[relKey])}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className="tabular-nums text-[11px]" style={{ color: retColor(item.distMa50) }}>
                  {item.distMa50 != null ? (item.distMa50 >= 0 ? '+' : '') + item.distMa50.toFixed(1) + '%' : '—'}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className="tabular-nums text-[11px]" style={{ color: 'var(--scanner-text2)' }}>
                  {item.atrExt50ma != null ? item.atrExt50ma.toFixed(1) : '—'}
                </span>
              </td>
              <td className="py-2.5 px-3 tabular-nums text-[11px]" style={{ color: 'var(--scanner-text2)' }}>
                {item.volRatio != null ? item.volRatio.toFixed(2) + 'x' : '—'}
              </td>
              <td className="py-2.5 px-3">
                <span className={`badge ${item.tier === 'Core' ? 'tier-Core' : item.tier === 'Active' ? 'tier-Active' : 'tier-Watch'}`}>
                  {item.tier}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MomentumScanTab({ momentumScan }) {
  const WINDOWS = ['1W', '1M', '3M', '6M'];
  const WINDOW_LABELS = { '1W': '1 Week', '1M': '1 Month', '3M': '3 Months', '6M': '6 Months' };
  const ABS_KEYS = { '1W': 'abs1w', '1M': 'abs1m', '3M': 'abs3m', '6M': 'abs6m' };
  const REL_KEYS = { '1W': 'rel1w', '1M': 'rel1m', '3M': 'rel3m', '6M': 'rel6m' };

  const [activeWindow, setActiveWindow] = useState('1W');
  const items = momentumScan?.[activeWindow] ?? [];

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Window selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[9px] font-semibold tracking-widest uppercase mr-2" style={{ color: 'var(--scanner-text3)' }}>Window</span>
        {WINDOWS.map(w => (
          <button key={w} className="font-mono text-[10px] font-bold px-4 py-2 transition-all"
            style={{
              background: activeWindow === w ? 'rgba(245,158,11,0.12)' : 'var(--scanner-bg2)',
              border: `1px solid ${activeWindow === w ? 'var(--scanner-accent)' : 'var(--scanner-border2)'}`,
              color: activeWindow === w ? 'var(--scanner-accent)' : 'var(--scanner-text3)',
              cursor: 'pointer',
            }}
            onClick={() => setActiveWindow(w)}>
            {w}
          </button>
        ))}
        <span className="text-[9px] ml-4" style={{ color: 'var(--scanner-text3)' }}>
          {items.length} assets
        </span>
        <div className="ml-auto">
          <CopyCsvButtons tableId="momentum-scan-table" />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4 p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
        <div className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--scanner-accent)' }}>
          {WINDOW_LABELS[activeWindow]} Absolute Momentum
        </div>
        <div className="text-[9px]" style={{ color: 'var(--scanner-text3)' }}>
          Click column headers to sort. Assets ranked by drawdown from {WINDOW_LABELS[activeWindow]} low — measures pure momentum vs recent lows.
        </div>
      </div>

      {/* Table */}
      <MomentumTable
        items={items}
        absKey={ABS_KEYS[activeWindow]}
        relKey={REL_KEYS[activeWindow]}
      />
    </div>
  );
}
