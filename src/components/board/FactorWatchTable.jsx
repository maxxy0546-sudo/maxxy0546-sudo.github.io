/**
 * FactorWatchTable — displays FactorWatch thematic basket performance data
 * from factorwatch.ai as scraped server-side and stored in snapshot.json's
 * factor_watch.baskets key.
 *
 * Shows 26 thematic baskets with 7 return columns: 1D, 5D, 20D, 60D, MTD,
 * YTD, 1Y. All values are percentage returns (no z-scores — the baskets
 * page doesn't provide them).
 *
 * Data source: factorwatch.ai (free educational project by Alex Corrino).
 * Scraped server-side by scripts/scrapers/factorWatch.js every 4h via
 * Cloudflare Worker cron. No client-side fetch to factorwatch.ai — all
 * data is baked into snapshot.json.
 *
 * Attribution: Data is clearly labeled with source link + "as of" date.
 */

import React, { useMemo } from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';
import CopyCsvButtons from './CopyCsvButtons';
import { useSortableTable } from '@/lib/board/useSortableTable';

function fmtRet(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function retColor(v) {
  if (v == null || !Number.isFinite(v)) return 'var(--scanner-text3)';
  return v > 0 ? 'var(--scanner-green)' : v < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
}

function retBg(v) {
  if (v == null || !Number.isFinite(v)) return 'transparent';
  const abs = Math.abs(v);
  if (abs >= 10) return v > 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,68,68,0.12)';
  return 'transparent';
}

const COLS = [
  { key: '1d_ret',  label: '1D' },
  { key: '5d_ret',  label: '5D' },
  { key: '20d_ret', label: '20D' },
  { key: '60d_ret', label: '60D' },
  { key: 'mtd_ret', label: 'MTD' },
  { key: 'ytd_ret', label: 'YTD' },
  { key: '1y_ret',  label: '1Y' },
];

function SectionLabel({ children, right = null }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
      <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>{children}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export default function FactorWatchTable() {
  const snapshot = useSnapshot();
  const fw = snapshot?.factor_watch;

  const baskets = fw?.baskets || {};
  const asOf = fw?.as_of;

  // Build rows from snapshot data
  const rows = useMemo(() => {
    return Object.entries(baskets).map(([name, data]) => ({
      basket: name,
      '1d_ret': data['1d_ret'],
      '5d_ret': data['5d_ret'],
      '20d_ret': data['20d_ret'],
      '60d_ret': data['60d_ret'],
      mtd_ret: data['mtd_ret'],
      ytd_ret: data['ytd_ret'],
      '1y_ret': data['1y_ret'],
    }));
  }, [baskets]);

  const { sorted, sortCol, sortDir, handleSort, getSortClass } = useSortableTable(rows, 'ytd_ret', 'desc');

  if (!fw || !baskets || Object.keys(baskets).length === 0) {
    return null;  // FactorWatch data not available
  }

  return (
    <div className="font-mono mb-5">
      <SectionLabel right={<CopyCsvButtons tableId="factorwatch-baskets-table" />}>
        Thematic Basket Performance · data from FactorWatch.ai
      </SectionLabel>

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
        <table id="factorwatch-baskets-table" className="board-table w-full border-collapse min-w-[800px]">
          <thead>
            <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
              <th
                className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left ${getSortClass('basket')}`}
                style={{ color: 'var(--scanner-text3)', cursor: 'pointer', position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' }}
                onClick={() => handleSort('basket')}
              >
                Basket
              </th>
              {COLS.map(col => (
                <th
                  key={col.key}
                  className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-right ${getSortClass(col.key)}`}
                  style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.basket}
                style={{ borderBottom: '1px solid var(--scanner-border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Basket name (sticky) */}
                <td className="py-2.5 px-3" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--scanner-text)' }}>{row.basket}</span>
                </td>
                {/* Return columns */}
                {COLS.map(col => (
                  <td key={col.key} className="py-2.5 px-3 text-right" style={{ background: retBg(row[col.key]) }}>
                    <span className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(row[col.key]) }}>
                      {fmtRet(row[col.key])}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source attribution */}
      <div className="text-[8px] mt-2 flex items-center gap-1 flex-wrap" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>
        <span>Source:</span>
        <a
          href="https://factorwatch.ai/baskets.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--scanner-accent)', textDecoration: 'none' }}
        >
          factorwatch.ai/baskets
        </a>
        <span>·</span>
        <span>26 thematic baskets · equal-weighted quintile portfolios.</span>
        <span>·</span>
        <span>Scraped server-side every 4h.</span>
        <span>·</span>
        <span>|ret| ≥ 10% highlighted.</span>
      </div>
    </div>
  );
}
