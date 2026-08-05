/**
 * ThemeScoresTab.jsx — TradFi theme scoring board.
 *
 * Calls computeThemeScores(tradData.assets) from tradfiScoring.js.
 * Shows per-theme scores (0-100) with 4-component breakdown + status labels.
 *
 * Status labels: DOMINANT / STRONG-HOT / EMERGING / STRONG / IMPROVING /
 *                NEUTRAL / DETERIORATING / FADING / WEAK
 */

import React, { useMemo, useState } from 'react';
import { computeThemeScores, getExtensionLists, getRegimeRead } from '@/lib/board/tradfiScoring';

function fmtPct(v, decimals = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%';
}

function scoreColor(score) {
  if (score >= 75) return 'var(--scanner-green)';
  if (score >= 60) return 'var(--scanner-text2)';
  if (score <= 35) return 'var(--scanner-red)';
  return 'var(--scanner-text3)';
}

function statusColor(status) {
  if (status === 'DOMINANT' || status === 'STRONG') return 'var(--scanner-green)';
  if (status === 'STRONG / HOT') return 'var(--scanner-accent)';
  if (status === 'EMERGING' || status === 'IMPROVING') return 'var(--scanner-blue)';
  if (status === 'FADING' || status === 'WEAK') return 'var(--scanner-red)';
  if (status === 'DETERIORATING') return 'var(--scanner-accent)';
  return 'var(--scanner-text3)';
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

export default function ThemeScoresTab({ tradData, isLoading }) {
  const assets = tradData?.assets || [];
  const [sortKey, setSortKey] = useState('score');

  const themeScores = useMemo(() => computeThemeScores(assets), [assets]);
  const extensions = useMemo(() => getExtensionLists(assets), [assets]);
  const regimeRead = useMemo(() => getRegimeRead(assets), [assets]);

  if (isLoading && !tradData) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-3xl mb-4 animate-pulse opacity-30">◈</div>
        <div className="text-sm mb-1" style={{ color: 'var(--scanner-text2)' }}>Loading theme scores…</div>
      </div>
    );
  }

  if (themeScores.length === 0) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-sm" style={{ color: 'var(--scanner-text3)' }}>No themes with enough data (need ≥3 names per theme).</div>
      </div>
    );
  }

  const sorted = [...themeScores].sort((a, b) => {
    if (sortKey === 'score') return b.score - a.score;
    if (sortKey === 'breadth') return b.breadth - a.breadth;
    if (sortKey === 'momentum') return b.momentum - a.momentum;
    if (sortKey === 'leadership') return b.leadership - a.leadership;
    if (sortKey === 'delta') return (b.score1dDelta ?? -999) - (a.score1dDelta ?? -999);
    if (sortKey === 'rs') return (b.avgRsQqq20d ?? -999) - (a.avgRsQqq20d ?? -999);
    return 0;
  });

  const sortOptions = [
    { key: 'score', label: 'Score' },
    { key: 'delta', label: '1D Δ' },
    { key: 'breadth', label: 'Breadth' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'momentum', label: 'Momentum' },
    { key: 'rs', label: 'RS QQQ' },
  ];

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Regime read */}
      <div className="mb-5">
        <SectionLabel>Regime Read</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-2.5 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Total Names</div>
            <div className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--scanner-text)' }}>{regimeRead.breadth.total}</div>
          </div>
          <div className="p-2.5 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>%Above 50DMA</div>
            <div className="text-[16px] font-bold tabular-nums" style={{ color: regimeRead.breadth.pctAbove50 >= 60 ? 'var(--scanner-green)' : regimeRead.breadth.pctAbove50 <= 40 ? 'var(--scanner-red)' : 'var(--scanner-text2)' }}>
              {regimeRead.breadth.pctAbove50.toFixed(0)}%
            </div>
          </div>
          <div className="p-2.5 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>New 20D Highs</div>
            <div className="text-[16px] font-bold tabular-nums" style={{ color: 'var(--scanner-green)' }}>{regimeRead.breadth.newHigh20d}</div>
          </div>
          <div className="p-2.5 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Up/Down Big (4%)</div>
            <div className="text-[16px] font-bold tabular-nums">
              <span style={{ color: 'var(--scanner-green)' }}>{regimeRead.breadth.upBig}</span>
              <span style={{ color: 'var(--scanner-text3)' }}> / </span>
              <span style={{ color: 'var(--scanner-red)' }}>{regimeRead.breadth.downBig}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Theme scores table */}
      <div className="mb-5">
        <SectionLabel right={
          <div className="flex gap-1">
            {sortOptions.map(o => (
              <button key={o.key} className="font-mono text-[9px] font-semibold px-2 py-1"
                style={{
                  background: sortKey === o.key ? 'rgba(245,158,11,0.12)' : 'var(--scanner-bg2)',
                  border: `1px solid ${sortKey === o.key ? 'var(--scanner-accent)' : 'var(--scanner-border2)'}`,
                  color: sortKey === o.key ? 'var(--scanner-accent)' : 'var(--scanner-text3)',
                  cursor: 'pointer'
                }}
                onClick={() => setSortKey(o.key)}>{o.label}</button>
            ))}
          </div>
        }>
          Theme Scores · {themeScores.length} themes
        </SectionLabel>
        <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>#</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>Theme</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>N</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Score</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>1D Δ</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>Status</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Breadth</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Lead</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Mom</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>%Above 20MA</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>%Above 50MA</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>5D %</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>20D %</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>RS QQQ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr key={t.theme}
                  style={{ borderBottom: '1px solid var(--scanner-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="py-2 px-2.5">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{t.rank}</span>
                  </td>
                  <td className="py-2 px-2.5">
                    <span className="text-[11px] font-bold" style={{ color: 'var(--scanner-text)' }}>{t.theme}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{t.nNames}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: scoreColor(t.score) }}>{t.score.toFixed(0)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.score1dDelta > 0 ? 'var(--scanner-green)' : t.score1dDelta < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)' }}>
                      {t.score1dDelta > 0 ? '+' : ''}{t.score1dDelta.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 px-2.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                      background: `${statusColor(t.status)}15`,
                      color: statusColor(t.status),
                      border: `1px solid ${statusColor(t.status)}35`,
                    }}>{t.status}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{t.breadth.toFixed(0)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{t.leadership.toFixed(0)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{t.momentum.toFixed(0)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.pctAbove20ma >= 60 ? 'var(--scanner-green)' : t.pctAbove20ma <= 40 ? 'var(--scanner-red)' : 'var(--scanner-text2)' }}>{t.pctAbove20ma.toFixed(0)}%</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.pctAbove50ma >= 60 ? 'var(--scanner-green)' : t.pctAbove50ma <= 40 ? 'var(--scanner-red)' : 'var(--scanner-text2)' }}>{t.pctAbove50ma.toFixed(0)}%</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.avgRet5d > 0 ? 'var(--scanner-green)' : t.avgRet5d < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)' }}>{fmtPct(t.avgRet5d)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.avgRet20d > 0 ? 'var(--scanner-green)' : t.avgRet20d < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)' }}>{fmtPct(t.avgRet20d)}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <span className="text-[10px] tabular-nums" style={{ color: t.avgRsQqq20d > 0 ? 'var(--scanner-green)' : t.avgRsQqq20d < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)' }}>{fmtPct(t.avgRsQqq20d)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extension lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Too Hot */}
        <div>
          <SectionLabel>Too Hot · ≥{extensions.thresholds.tooHotAtr} ATR above 50MA</SectionLabel>
          <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            {extensions.tooHot.length === 0 ? (
              <div className="p-3 text-[10px]" style={{ color: 'var(--scanner-text3)' }}>None — market not overextended.</div>
            ) : (
              extensions.tooHot.map(a => (
                <div key={a.symbol} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                  <div>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                    <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-accent)' }}>{a.atrExt50ma?.toFixed(1)}σ</span>
                    <span className="text-[10px] tabular-nums" style={{ color: a.ret1d > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}>{fmtPct(a.ret1d)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clean Momentum */}
        <div>
          <SectionLabel>Clean Momentum · ATR [{extensions.thresholds.cleanAtrMin}, {extensions.thresholds.cleanAtrMax}]</SectionLabel>
          <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            {extensions.cleanMomentum.length === 0 ? (
              <div className="p-3 text-[10px]" style={{ color: 'var(--scanner-text3)' }}>None — no clean momentum setups.</div>
            ) : (
              extensions.cleanMomentum.map(a => (
                <div key={a.symbol} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                  <div>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                    <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] tabular-nums" style={{ color: a.rsQqq20d > 0 ? 'var(--scanner-green)' : 'var(--scanner-text3)' }}>RS {fmtPct(a.rsQqq20d)}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-green)' }}>{fmtPct(a.ret5d)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fading */}
        <div>
          <SectionLabel>Fading · lost 20MA, 5D {'<'} -3%</SectionLabel>
          <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            {extensions.fading.length === 0 ? (
              <div className="p-3 text-[10px]" style={{ color: 'var(--scanner-text3)' }}>None — no broad fading.</div>
            ) : (
              extensions.fading.map(a => (
                <div key={a.symbol} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                  <div>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                    <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-red)' }}>{fmtPct(a.ret5d)}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{a.distMa50?.toFixed(1)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
