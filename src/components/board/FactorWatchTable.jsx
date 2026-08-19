/**
 * FactorWatchTable — displays S&P 500 factor spread monitor data from
 * FactorWatch (factorwatch.ai) as scraped server-side and stored in
 * snapshot.json's factor_watch key.
 *
 * Shows 7 factors (Momentum, Low Volatility, Dividend Yield, Quality,
 * Value, Size, High Beta) with 1d/5d/20d/60d returns + z-scores,
 * plus MTD, YTD, and 1y returns.
 *
 * Also shows estimate revision spreads (top quintile - bottom quintile)
 * for each factor — a leading indicator of earnings momentum.
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

function fmtSigma(v) {
  if (v == null || !Number.isFinite(v)) return '';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + 'σ';
}

function retColor(v) {
  if (v == null || !Number.isFinite(v)) return 'var(--scanner-text3)';
  return v > 0 ? 'var(--scanner-green)' : v < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
}

function sigmaColor(v) {
  if (v == null || !Number.isFinite(v)) return 'var(--scanner-text3)';
  const abs = Math.abs(v);
  if (abs >= 2) return v > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)';
  return 'var(--scanner-text2)';
}

// |z| >= 2 highlight
function sigmaBg(v) {
  if (v == null || !Number.isFinite(v)) return 'transparent';
  return Math.abs(v) >= 2
    ? (v > 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,68,68,0.12)')
    : 'transparent';
}

const FACTOR_LABELS = {
  momentum: 'Momentum (12-1mo)',
  low_volatility: 'Low Volatility',
  dividend_yield: 'Dividend Yield',
  quality: 'Quality',
  value: 'Value',
  size: 'Size (Small Cap)',
  high_beta: 'High Beta',
};

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

  const sp500 = fw?.sp500?.factors || {};
  const revisions = fw?.sp500?.revisions || {};
  const asOf = fw?.as_of;

  // Build rows from snapshot data
  const rows = useMemo(() => {
    return Object.entries(sp500).map(([key, data]) => {
      const rev = revisions[key] || {};
      return {
        factor: key,
        label: FACTOR_LABELS[key] || key,
        '1d_ret': data['1d_ret'],
        '1d_sigma': data['1d_sigma'],
        '5d_ret': data['5d_ret'],
        '5d_sigma': data['5d_sigma'],
        '20d_ret': data['20d_ret'],
        '20d_sigma': data['20d_sigma'],
        '60d_ret': data['60d_ret'],
        '60d_sigma': data['60d_sigma'],
        mtd_ret: data['mtd_ret'],
        ytd_ret: data['ytd_ret'],
        '1y_ret': data['1y_ret'],
        rev_top: rev.top,
        rev_bot: rev.bot,
        rev_spread: rev.spread,
      };
    });
  }, [sp500, revisions]);

  const { sorted, sortCol, sortDir, handleSort, getSortClass } = useSortableTable(rows, '20d_ret', 'desc');

  if (!fw || !sp500 || Object.keys(sp500).length === 0) {
    return null;  // FactorWatch data not available
  }

  return (
    <div className="font-mono mb-5">
      <SectionLabel right={<CopyCsvButtons tableId="factorwatch-sp500-table" />}>
        FactorWatch · S&P 500 Factor Spread Monitor
        {asOf && (
          <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{
            background: 'var(--scanner-bg2)',
            color: 'var(--scanner-text3)',
            border: '1px solid var(--scanner-border2)',
          }}>
            as of {asOf}
          </span>
        )}
      </SectionLabel>

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
        <table id="factorwatch-sp500-table" className="board-table w-full border-collapse min-w-[900px]">
          <thead>
            <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
              <th className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left ${getSortClass('label')}`}
                  style={{ color: 'var(--scanner-text3)', cursor: 'pointer', position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' }}
                  onClick={() => handleSort('label')}>Factor</th>
              {['1d_ret','5d_ret','20d_ret','60d_ret','mtd_ret','ytd_ret','1y_ret'].map(key => (
                <th key={key}
                    className={`text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-right ${getSortClass(key)}`}
                    style={{ color: 'var(--scanner-text3)', cursor: 'pointer' }}
                    onClick={() => handleSort(key)}>
                  {key.replace('_ret','').toUpperCase()}
                </th>
              ))}
              <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left" style={{ color: 'var(--scanner-text3)' }}>
                Est. Revisions (Top − Bot)
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.factor}
                style={{ borderBottom: '1px solid var(--scanner-border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Factor name (sticky) */}
                <td className="py-2.5 px-3" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--scanner-text)' }}>{row.label}</span>
                </td>
                {/* 1D */}
                <td className="py-2.5 px-3 text-right" style={{ background: sigmaBg(row['1d_sigma']) }}>
                  <div className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(row['1d_ret']) }}>{fmtRet(row['1d_ret'])}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: sigmaColor(row['1d_sigma']) }}>{fmtSigma(row['1d_sigma'])}</div>
                </td>
                {/* 5D */}
                <td className="py-2.5 px-3 text-right" style={{ background: sigmaBg(row['5d_sigma']) }}>
                  <div className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(row['5d_ret']) }}>{fmtRet(row['5d_ret'])}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: sigmaColor(row['5d_sigma']) }}>{fmtSigma(row['5d_sigma'])}</div>
                </td>
                {/* 20D */}
                <td className="py-2.5 px-3 text-right" style={{ background: sigmaBg(row['20d_sigma']) }}>
                  <div className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(row['20d_ret']) }}>{fmtRet(row['20d_ret'])}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: sigmaColor(row['20d_sigma']) }}>{fmtSigma(row['20d_sigma'])}</div>
                </td>
                {/* 60D */}
                <td className="py-2.5 px-3 text-right" style={{ background: sigmaBg(row['60d_sigma']) }}>
                  <div className="tabular-nums text-[11px] font-semibold" style={{ color: retColor(row['60d_ret']) }}>{fmtRet(row['60d_ret'])}</div>
                  <div className="text-[9px] tabular-nums" style={{ color: sigmaColor(row['60d_sigma']) }}>{fmtSigma(row['60d_sigma'])}</div>
                </td>
                {/* MTD */}
                <td className="py-2.5 px-3 text-right">
                  <span className="tabular-nums text-[11px]" style={{ color: retColor(row.mtd_ret) }}>{fmtRet(row.mtd_ret)}</span>
                </td>
                {/* YTD */}
                <td className="py-2.5 px-3 text-right">
                  <span className="tabular-nums text-[11px]" style={{ color: retColor(row.ytd_ret) }}>{fmtRet(row.ytd_ret)}</span>
                </td>
                {/* 1Y */}
                <td className="py-2.5 px-3 text-right">
                  <span className="tabular-nums text-[11px]" style={{ color: retColor(row['1y_ret']) }}>{fmtRet(row['1y_ret'])}</span>
                </td>
                {/* Estimate Revisions */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-[10px]" style={{ color: 'var(--scanner-green)' }} title="Top quintile revision %">
                      {row.rev_top != null ? (row.rev_top >= 0 ? '+' : '') + row.rev_top.toFixed(0) + '%' : '—'}
                    </span>
                    <span style={{ color: 'var(--scanner-text3)', fontSize: 9 }}>−</span>
                    <span className="tabular-nums text-[10px]" style={{ color: 'var(--scanner-red)' }} title="Bottom quintile revision %">
                      {row.rev_bot != null ? (row.rev_bot >= 0 ? '+' : '') + row.rev_bot.toFixed(0) + '%' : '—'}
                    </span>
                    <span className="tabular-nums text-[10px] font-semibold" style={{
                      color: row.rev_spread > 0 ? 'var(--scanner-green)' : row.rev_spread < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)',
                    }} title="Top − Bottom spread (positive = earnings momentum)">
                      ({row.rev_spread != null ? (row.rev_spread >= 0 ? '+' : '') + row.rev_spread.toFixed(0) + '%' : '—'})
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source attribution */}
      <div className="text-[8px] mt-2 flex items-center gap-1 flex-wrap" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>
        <span>Source:</span>
        <a
          href="https://factorwatch.ai/sp500.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--scanner-accent)', textDecoration: 'none' }}
        >
          factorwatch.ai/sp500
        </a>
        <span>·</span>
        <span>Point-in-time quintile portfolios · z-scored moves · estimate revisions.</span>
        <span>·</span>
        <span>Scraped server-side every 4h.</span>
        <span>·</span>
        <span>|z| ≥ 2 highlighted.</span>
      </div>
    </div>
  );
}
