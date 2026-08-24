/**
 * EtfPulseTab.jsx — Cross-asset ETF rotation board.
 *
 * Calls getEtfPulse(tradData.assets) from tradfiScoring.js.
 * Shows three sections:
 *   1. Style rotation (5 ratio pairs: IWM/SPY, RSP/SPY, QQQ/SPY, IWF/IWD, EEM/SPY)
 *   2. Risk pulse (HYG/TLT, GLD/SPY, UUP, UVXY, TLT)
 *   3. Sector rotation (11 sector ETFs ranked by 20D RS vs SPY with diverging bars)
 */

import React, { useMemo } from 'react';
import { getEtfPulse } from '@/lib/board/tradfiScoring';
import { FactorUniverseTable } from './SMBFeatures';

function fmtPct(v, decimals = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%';
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

export default function EtfPulseTab({ tradData, isLoading }) {
  const assets = tradData?.assets || [];
  const pulse = useMemo(() => getEtfPulse(assets), [assets]);

  if (isLoading && !tradData) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-3xl mb-4 animate-pulse opacity-30">◈</div>
        <div className="text-sm mb-1" style={{ color: 'var(--scanner-text2)' }}>Loading ETF pulse…</div>
      </div>
    );
  }

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Style Rotation */}
      <div className="mb-6">
        <SectionLabel>Style Rotation · ratio pairs (positive = numerator outperforming)</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {pulse.styleRotation.map(pair => (
            <div key={pair.label} className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>{pair.label}</div>
              <div className="text-[11px] font-bold mb-1" style={{ color: 'var(--scanner-text)' }}>{pair.num} / {pair.den}</div>
              <div className="flex gap-3 text-[10px] tabular-nums">
                <span style={{ color: retColor(pair.ret1d) }}>1D {fmtPct(pair.ret1d)}</span>
                <span style={{ color: retColor(pair.ret5d) }}>5D {fmtPct(pair.ret5d)}</span>
                <span style={{ color: retColor(pair.ret20d) }}>20D {fmtPct(pair.ret20d)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Pulse */}
      <div className="mb-6">
        <SectionLabel>Risk Pulse · safe-haven vs risk assets</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {pulse.riskPulse.map(item => (
            <div key={item.label} className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>{item.label}</div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--scanner-text2)' }}>{item.context}</div>
              <div className="flex gap-3 text-[10px] tabular-nums">
                <span style={{ color: retColor(item.ret1d) }}>1D {fmtPct(item.ret1d)}</span>
                <span style={{ color: retColor(item.ret5d) }}>5D {fmtPct(item.ret5d)}</span>
                <span style={{ color: retColor(item.ret20d) }}>20D {fmtPct(item.ret20d)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sector Rotation */}
      <div>
        <SectionLabel right={<span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>Sorted by 20D RS vs SPY</span>}>
          Sector Rotation · 11 sector ETFs
        </SectionLabel>
        <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
          <table id="sector-rotation-table" className="board-table w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>Sector</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>1D %</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>5D %</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>20D %</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>RS SPY 5D</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>RS SPY 20D</th>
                <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)' }}>20D RS Bar</th>
              </tr>
            </thead>
            <tbody>
              {pulse.sectorRotation.map(s => {
                const rs20 = s.rsSpy20d ?? 0;
                const maxAbs = Math.max(...pulse.sectorRotation.map(x => Math.abs(x.rsSpy20d ?? 0)), 0.05);
                const barWidth = Math.abs(rs20) / maxAbs * 50;  // max 50% width
                const isLeading = rs20 >= 0;
                return (
                  <tr key={s.ticker}
                    style={{ borderBottom: '1px solid var(--scanner-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-2 px-2.5">
                      <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{s.ticker}</span>
                      <span className="text-[9px] ml-1.5" style={{ color: 'var(--scanner-text3)' }}>{s.label}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(s.ret1d) }}>{fmtPct(s.ret1d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(s.ret5d) }}>{fmtPct(s.ret5d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(s.ret20d) }}>{fmtPct(s.ret20d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(s.rsSpy5d) }}>{fmtPct(s.rsSpy5d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: retColor(s.rsSpy20d) }}>{fmtPct(s.rsSpy20d)}</span>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="relative" style={{ width: '100%', height: 12 }}>
                        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: '1px', background: 'var(--scanner-border3)' }} />
                        {isLeading ? (
                          <div className="absolute top-0 bottom-0 rounded-sm" style={{
                            left: '50%',
                            width: `${barWidth}%`,
                            background: 'var(--scanner-green)',
                            opacity: 0.7,
                          }} />
                        ) : (
                          <div className="absolute top-0 bottom-0 rounded-sm" style={{
                            right: '50%',
                            width: `${barWidth}%`,
                            background: 'var(--scanner-red)',
                            opacity: 0.7,
                          }} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-[8px] mt-2" style={{ color: 'var(--scanner-text3)' }}>
          Green bar (right) = sector outperforming SPY over 20D. Red bar (left) = underperforming.
        </div>
      </div>

      {/* Factor Universe — ETF Flow Grid (moved from Theme Scores tab) */}
      <FactorUniverseTable />
    </div>
  );
}
