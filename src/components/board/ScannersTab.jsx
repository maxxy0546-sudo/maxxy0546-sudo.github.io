/**
 * ScannersTab.jsx — TradFi scanner aggregations.
 *
 * Calls multiple scoring functions from tradfiScoring.js:
 *   - getNewHighsLows(assets) — today's 52W highs/lows
 *   - getRvolScan(assets) — relative volume scanner
 *   - getEtfExtension(assets) — ETF extension rank
 *   - getBreadthThrust(assets) — Zweig breadth thrust (current-day approx)
 *
 * Sub-tabs: New Highs/Lows · RVOL · ETF Extension · Breadth
 */

import React, { useMemo, useState } from 'react';
import { getNewHighsLows, getRvolScan, getEtfExtension, getBreadthThrust } from '@/lib/board/tradfiScoring';
import CopyCsvButtons from './CopyCsvButtons';

function fmtPct(v, decimals = 2) {
  if (v == null || !Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%';
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4);
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

function SubTab({ active, onClick, children }) {
  return (
    <button className="font-mono text-[9px] font-semibold px-3 py-1.5 transition-all"
      style={{
        background: active ? 'rgba(245,158,11,0.12)' : 'var(--scanner-bg2)',
        border: `1px solid ${active ? 'var(--scanner-accent)' : 'var(--scanner-border2)'}`,
        color: active ? 'var(--scanner-accent)' : 'var(--scanner-text3)',
        cursor: 'pointer',
      }}
      onClick={onClick}>{children}</button>
  );
}

export default function ScannersTab({ tradData, isLoading, breadthHistory }) {
  const assets = tradData?.assets || [];
  const [subTab, setSubTab] = useState('newHighsLows');

  const newHighsLows = useMemo(() => getNewHighsLows(assets), [assets]);
  const rvolScan = useMemo(() => getRvolScan(assets, { minRatio: 1.5, topN: 30 }), [assets]);
  const etfExtension = useMemo(() => getEtfExtension(assets), [assets]);
  const breadthThrust = useMemo(() => getBreadthThrust(assets, breadthHistory || null), [assets, breadthHistory]);

  if (isLoading && !tradData) {
    return (
      <div className="font-mono text-center py-20 px-5">
        <div className="text-3xl mb-4 animate-pulse opacity-30">◈</div>
        <div className="text-sm mb-1" style={{ color: 'var(--scanner-text2)' }}>Loading scanners…</div>
      </div>
    );
  }

  return (
    <div className="font-mono px-5 md:px-8 py-5">
      {/* Sub-tab selector */}
      <div className="flex gap-1 mb-5">
        <SubTab active={subTab === 'newHighsLows'} onClick={() => setSubTab('newHighsLows')}>New Highs/Lows</SubTab>
        <SubTab active={subTab === 'rvol'} onClick={() => setSubTab('rvol')}>RVOL Scanner</SubTab>
        <SubTab active={subTab === 'etfExtension'} onClick={() => setSubTab('etfExtension')}>ETF Extension</SubTab>
        <SubTab active={subTab === 'breadth'} onClick={() => setSubTab('breadth')}>Breadth Thrust</SubTab>
      </div>

      {/* New Highs/Lows */}
      {subTab === 'newHighsLows' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionLabel right={<span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{newHighsLows.newHighs.length} today</span>}>
              New 52-Week Highs
            </SectionLabel>
            <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
              {newHighsLows.newHighs.length === 0 ? (
                <div className="p-3 text-[10px]" style={{ color: 'var(--scanner-text3)' }}>No new 52W highs today.</div>
              ) : (
                newHighsLows.newHighs.map(a => (
                  <div key={a.symbol} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                    <div>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                      <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{fmtPrice(a.price)}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret1d) }}>{fmtPct(a.ret1d)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <SectionLabel right={<span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{newHighsLows.newLows.length} today</span>}>
              New 52-Week Lows
            </SectionLabel>
            <div className="rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
              {newHighsLows.newLows.length === 0 ? (
                <div className="p-3 text-[10px]" style={{ color: 'var(--scanner-text3)' }}>No new 52W lows today.</div>
              ) : (
                newHighsLows.newLows.map(a => (
                  <div key={a.symbol} className="flex justify-between items-center px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                    <div>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                      <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{fmtPrice(a.price)}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret1d) }}>{fmtPct(a.ret1d)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* RVOL Scanner */}
      {subTab === 'rvol' && (
        <div>
          <SectionLabel right={<div className="flex items-center gap-2"><span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{rvolScan.length} tickers</span><CopyCsvButtons tableId="rvol-table" /></div>}>
            Relative Volume Scanner · 1D vol / 20D avg
          </SectionLabel>
          <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            <table id="rvol-table" className="board-table w-full border-collapse min-w-[800px]">
              <thead>
                <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)', position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' }}>Ticker</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>rVOL</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Price</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>1D %</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>5D %</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>ATR Ext</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>% 52W High</th>
                </tr>
              </thead>
              <tbody>
                {rvolScan.length === 0 ? (
                  <tr><td colSpan={7} className="py-4 text-center text-[10px]" style={{ color: 'var(--scanner-text3)' }}>No tickers with rVOL ≥ 1.5x today.</td></tr>
                ) : (
                  rvolScan.map(a => (
                    <tr key={a.symbol}
                      style={{ borderBottom: '1px solid var(--scanner-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="py-2 px-2.5" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                        <span className="text-[11px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                        <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: a.volRatio >= 3 ? 'var(--scanner-accent)' : a.volRatio >= 2 ? 'var(--scanner-green)' : 'var(--scanner-text2)' }}>
                          {a.volRatio?.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{fmtPrice(a.price)}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret1d) }}>{fmtPct(a.ret1d)}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret5d) }}>{fmtPct(a.ret5d)}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: a.atrExt50ma >= 8 ? 'var(--scanner-accent)' : 'var(--scanner-text2)' }}>{a.atrExt50ma?.toFixed(1)}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{a.pctFrom52wHigh != null ? a.pctFrom52wHigh.toFixed(1) + '%' : '—'}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ETF Extension */}
      {subTab === 'etfExtension' && (
        <div>
          <SectionLabel right={<div className="flex items-center gap-2"><span className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{etfExtension.length} ETFs</span><CopyCsvButtons tableId="etf-extension-table" /></div>}>
            ETF Extension Rank · sorted by ATR ext from 50DMA
          </SectionLabel>
          <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            <table id="etf-extension-table" className="board-table w-full border-collapse min-w-[800px]">
              <thead>
                <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-left" style={{ color: 'var(--scanner-text3)', position: 'sticky', left: 0, zIndex: 10, background: 'var(--scanner-bg2)' }}>Ticker</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>ATR Ext</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Price</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>5D %</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>20D %</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>Dist 50MA</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>rVOL</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>% 52W High</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-2.5 text-right" style={{ color: 'var(--scanner-text3)' }}>ADR Used</th>
                </tr>
              </thead>
              <tbody>
                {etfExtension.map(a => (
                  <tr key={a.symbol}
                    style={{ borderBottom: '1px solid var(--scanner-border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="py-2 px-2.5" style={{ position: 'sticky', left: 0, zIndex: 5, background: 'var(--scanner-bg1)' }}>
                      <span className="text-[11px] font-bold" style={{ color: 'var(--scanner-text)' }}>{a.symbol}</span>
                      <span className="text-[9px] ml-1" style={{ color: 'var(--scanner-text3)' }}>{a.category}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: a.atrExt50ma >= 8 ? 'var(--scanner-accent)' : a.atrExt50ma >= 5 ? 'var(--scanner-green)' : a.atrExt50ma <= -5 ? 'var(--scanner-red)' : 'var(--scanner-text2)' }}>
                        {a.atrExt50ma?.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{fmtPrice(a.price)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret5d) }}>{fmtPct(a.ret5d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(a.ret20d) }}>{fmtPct(a.ret20d)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: retColor(a.distMa50 / 100) }}>{a.distMa50 != null ? a.distMa50.toFixed(1) + '%' : '—'}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: a.volRatio >= 2 ? 'var(--scanner-accent)' : 'var(--scanner-text2)' }}>{a.volRatio?.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{a.pctFrom52wHigh != null ? a.pctFrom52wHigh.toFixed(1) + '%' : '—'}</span>
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: a.adrUsedPct >= 150 ? 'var(--scanner-accent)' : a.adrUsedPct <= 50 ? 'var(--scanner-text3)' : 'var(--scanner-text2)' }}>
                        {a.adrUsedPct != null ? a.adrUsedPct.toFixed(0) + '%' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breadth Thrust */}
      {subTab === 'breadth' && (
        <div>
          <SectionLabel>Breadth Thrust · Zweig-style (current day)</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Advancers</div>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--scanner-green)' }}>{breadthThrust.advancers}</div>
            </div>
            <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Decliners</div>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--scanner-red)' }}>{breadthThrust.decliners}</div>
            </div>
            <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
              <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Adv/Dec Ratio</div>
              <div className="text-[18px] font-bold tabular-nums" style={{ color: breadthThrust.currentAdvDecRatio > 0.6 ? 'var(--scanner-green)' : breadthThrust.currentAdvDecRatio < 0.4 ? 'var(--scanner-red)' : 'var(--scanner-text2)' }}>
                {(breadthThrust.currentAdvDecRatio * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[9px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-accent)' }}>Zone: {breadthThrust.zone}</div>
            <div className="text-[10px]" style={{ color: 'var(--scanner-text3)' }}>{breadthThrust.note}</div>
          </div>
        </div>
      )}
    </div>
  );
}
