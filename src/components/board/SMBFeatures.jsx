/**
 * EnvironmentPanel — displays the environment temperature model + CBOE P/C ratios.
 *
 * Reads from snapshot.environment + snapshot.cboe_pc via useSnapshot.
 * Shows: temperature gauge (0-100), verdict, posture, flags, indicator tiles,
 * and CBOE put/call ratios (equity/index/total) with sentiment labels.
 *
 * Placement: Macro Regime page, between the Grand Composite row and the
 * Composite Gauges row.
 */

import React from 'react';
import { useSnapshot } from '@/hooks/useSnapshot';

function tempColor(temp) {
  if (temp == null) return 'var(--scanner-text3)';
  if (temp < 30) return 'var(--scanner-green)';
  if (temp < 55) return 'var(--scanner-accent)';
  if (temp < 75) return '#ff9800';
  return 'var(--scanner-red)';
}

function pcColor(ratio, series) {
  if (ratio == null) return 'var(--scanner-text3)';
  // Higher P/C = more bearish
  if (series === 'equity') return ratio > 0.9 ? 'var(--scanner-red)' : ratio < 0.6 ? 'var(--scanner-green)' : 'var(--scanner-text2)';
  if (series === 'index') return ratio > 1.3 ? 'var(--scanner-red)' : ratio < 0.9 ? 'var(--scanner-green)' : 'var(--scanner-text2)';
  return ratio > 1.1 ? 'var(--scanner-red)' : ratio < 0.9 ? 'var(--scanner-green)' : 'var(--scanner-text2)';
}

export function EnvironmentPanel() {
  const snapshot = useSnapshot();
  const env = snapshot?.environment;
  const cboe = snapshot?.cboe_pc;

  if (!env && !cboe) return null;

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Environment Temperature */}
      {env && (
        <div className="rounded-lg p-5" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
          <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--scanner-text3)' }}>
            ENVIRONMENT TEMPERATURE
          </div>
          <div className="flex items-center gap-6">
            {/* Gauge */}
            <div className="text-center flex-shrink-0">
              <span className="text-[48px] font-bold tabular-nums" style={{ color: tempColor(env.temperature) }}>
                {env.temperature ?? '—'}
              </span>
              <span className="text-[18px]" style={{ color: 'var(--scanner-text3)' }}>/100</span>
            </div>
            {/* Verdict + posture */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold mb-1" style={{ color: tempColor(env.temperature) }}>
                {env.verdict}
              </div>
              <div className="text-[9px] leading-relaxed" style={{ color: 'var(--scanner-text2)' }}>
                {env.posture}
              </div>
            </div>
          </div>

          {/* Temperature bar */}
          <div className="h-2 rounded-sm overflow-hidden mt-4 mb-4" style={{ background: 'var(--scanner-border)' }}>
            <div className="h-full transition-all duration-500" style={{
              width: `${env.temperature ?? 0}%`,
              background: tempColor(env.temperature),
            }} />
          </div>

          {/* Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {env.tiles?.map(tile => (
              <div key={tile.name} className="p-2 rounded" style={{ background: 'var(--scanner-bg1)', border: '1px solid var(--scanner-border)' }}>
                <div className="text-[8px] font-semibold tracking-wider uppercase" style={{ color: 'var(--scanner-text3)' }}>{tile.name}</div>
                <div className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--scanner-text)' }}>
                  {tile.value != null ? tile.value.toFixed(2) : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Flags */}
          {env.flags?.length > 0 && (
            <div className="space-y-1">
              {env.flags.map((flag, i) => (
                <div key={i} className="text-[9px] flex items-start gap-1.5" style={{ color: 'var(--scanner-accent)' }}>
                  <span className="flex-shrink-0">⚠</span>
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}

          {/* Contributions */}
          <div className="text-[8px] mt-3 space-y-1" style={{ color: 'var(--scanner-text3)' }}>
            {env.contributions?.map(c => (
              <div key={c.name} className="flex justify-between items-center">
                <span>{c.name} ({Math.round(c.weight * 100)}%)</span>
                <div className="flex items-center gap-2 flex-1 max-w-[120px] ml-2">
                  <div className="flex-1 h-1 rounded-sm overflow-hidden" style={{ background: 'var(--scanner-border)' }}>
                    <div className="h-full" style={{ width: `${c.score}%`, background: tempColor(c.score) }} />
                  </div>
                  <span className="tabular-nums w-6 text-right">{c.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CBOE Put/Call Ratios */}
      {cboe && Object.keys(cboe).length > 0 && (
        <div className="rounded-lg p-5" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
          <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--scanner-text3)' }}>
            CBOE PUT/CALL RATIOS
          </div>
          <div className="space-y-3">
            {Object.entries(cboe).map(([series, data]) => (
              <div key={series} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--scanner-bg1)', border: '1px solid var(--scanner-border)' }}>
                <div>
                  <div className="text-[10px] font-bold capitalize" style={{ color: 'var(--scanner-text)' }}>{series} P/C</div>
                  <div className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>10D SMA: {data.sma_10d ?? '—'}</div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-bold tabular-nums" style={{ color: pcColor(data.latest?.pc_ratio, series) }}>
                    {data.latest?.pc_ratio?.toFixed(3) ?? '—'}
                  </div>
                  <div className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{data.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[8px] mt-3" style={{ color: 'var(--scanner-text3)', opacity: 0.6 }}>
            Source: CBOE public CSVs · Free, end-of-day · Equity = retail sentiment, Index = hedge demand
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LeveredAppetiteStrip — summary strip for the Levered ETFs tab.
 * Shows volume-weighted long vs short z-scores + short_share hedging gauge.
 */
export function LeveredAppetiteStrip() {
  const snapshot = useSnapshot();
  const la = snapshot?.levered_appetite;

  if (!la || !la.long || !la.short) return null;

  const shortShare = la.short_share ?? 0;
  const ssColor = shortShare > 25 ? 'var(--scanner-red)' : shortShare > 15 ? 'var(--scanner-accent)' : 'var(--scanner-green)';

  return (
    <div className="mb-4 rounded-lg p-4" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
      <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--scanner-text3)' }}>
        RISK APPETITE SUMMARY · Levered Complex
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Long z */}
        <div>
          <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Long Z (vol-weighted)</div>
          <div className="text-[18px] font-bold tabular-nums" style={{ color: la.long.avg_z > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}>
            {la.long.avg_z > 0 ? '+' : ''}{la.long.avg_z?.toFixed(2)}
          </div>
          <div className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{la.long.count} ETFs · {la.long.avg_ret_1d?.toFixed(2)}% avg</div>
        </div>
        {/* Short z */}
        <div>
          <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Short Z (vol-weighted)</div>
          <div className="text-[18px] font-bold tabular-nums" style={{ color: la.short.avg_z > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}>
            {la.short.avg_z > 0 ? '+' : ''}{la.short.avg_z?.toFixed(2)}
          </div>
          <div className="text-[8px]" style={{ color: 'var(--scanner-text3)' }}>{la.short.count} ETFs · {la.short.avg_ret_1d?.toFixed(2)}% avg</div>
        </div>
        {/* Short share */}
        <div>
          <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Short Share (hedging)</div>
          <div className="text-[18px] font-bold tabular-nums" style={{ color: ssColor }}>
            {shortShare.toFixed(1)}%
          </div>
          {/* Bar */}
          <div className="h-1.5 rounded-sm overflow-hidden mt-1" style={{ background: 'var(--scanner-border)', width: 80 }}>
            <div className="h-full" style={{ width: `${Math.min(100, shortShare * 3)}%`, background: ssColor }} />
          </div>
        </div>
        {/* Label */}
        <div>
          <div className="text-[8px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--scanner-text3)' }}>Verdict</div>
          <div className="text-[11px] font-bold" style={{ color: ssColor }}>
            {la.label}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * FactorUniverseTable — curated ETF basket flow grid with flow_z.
 * Shows categories (Concentration, Index ETFs, Cross-Asset) with baskets
 * sorted by flow_z (money flowing in = positive z).
 */
export function FactorUniverseTable() {
  const snapshot = useSnapshot();
  const fu = snapshot?.factor_universe;

  if (!fu?.categories?.length) return null;

  return (
    <div className="font-mono mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
          Factor Universe · ETF Flow Grid
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {fu.categories.map(cat => (
          <div key={cat.category} className="rounded" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)' }}>
            <div className="text-[9px] font-bold tracking-wider uppercase px-3 py-2" style={{ color: 'var(--scanner-accent)', borderBottom: '1px solid var(--scanner-border2)' }}>
              {cat.category}
            </div>
            {cat.baskets.map(b => {
              const flowColor = b.flow_z > 1 ? 'var(--scanner-green)' : b.flow_z < -0.5 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
              const retColor = b.avg_ret_1d > 0 ? 'var(--scanner-green)' : b.avg_ret_1d < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)';
              return (
                <div key={b.name} className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--scanner-text)' }}>{b.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] tabular-nums" style={{ color: retColor }} title="Avg 1D return">
                      {b.avg_ret_1d != null ? (b.avg_ret_1d >= 0 ? '+' : '') + b.avg_ret_1d.toFixed(2) + '%' : '—'}
                    </span>
                    <span className="text-[9px] tabular-nums font-semibold" style={{ color: flowColor }} title="Flow z: today's $-vol vs 30D avg">
                      {b.flow_z != null ? (b.flow_z >= 0 ? '+' : '') + b.flow_z.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="text-[8px] mt-2" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>
        flow_z = today's basket dollar-volume vs trailing 30-day average · positive = money flowing in
      </div>
    </div>
  );
}

/**
 * CryptoGridTable — 6-timeframe return grid for crypto baskets.
 * Shows baskets (Benchmarks, Layer 1s, Memecoins, AI, etc.) with
 * daily/weekly/monthly/quarterly/ytd/yearly returns.
 */
export function CryptoGridTable() {
  const snapshot = useSnapshot();
  const grid = snapshot?.crypto_grid;

  if (!grid || Object.keys(grid).length === 0) return null;

  const TIMEFRAMES = ['daily', 'weekly', 'monthly', 'qtr', 'ytd', 'yearly'];
  const TF_LABELS = { daily: '1D', weekly: '1W', monthly: '1M', qtr: '3M', ytd: '60D', yearly: '90D' };

  function fmtRet(v) {
    if (v == null) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  function retColor(v) {
    if (v == null) return 'var(--scanner-text3)';
    return v > 0 ? 'var(--scanner-green)' : v < 0 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
  }

  return (
    <div className="font-mono mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
          Crypto 6-Timeframe Return Grid
        </span>
      </div>

      {Object.entries(grid).map(([basketName, data]) => (
        <div key={basketName} className="mb-4">
          <div className="text-[10px] font-bold tracking-wider uppercase mb-2" style={{ color: 'var(--scanner-text2)' }}>
            {basketName} · {data.rows?.length || 0} coins
            <span className="ml-3 text-[8px]" style={{ color: 'var(--scanner-text3)' }}>
              Avg: {TIMEFRAMES.map(tf => `${TF_LABELS[tf]} ${data.avg?.[tf] != null ? fmtRet(data.avg[tf]) : '—'}`).join(' · ')}
            </span>
          </div>
          <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
            <table className="board-table w-full border-collapse min-w-[600px]">
              <thead>
                <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-3 text-left" style={{ color: 'var(--scanner-text3)' }}>Coin</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-3 text-right" style={{ color: 'var(--scanner-text3)' }}>Price</th>
                  {TIMEFRAMES.map(tf => (
                    <th key={tf} className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2 px-3 text-right" style={{ color: 'var(--scanner-text3)' }}>{TF_LABELS[tf]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows?.map(row => (
                  <tr key={row.symbol} style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                    <td className="py-2 px-3">
                      <span className="text-[11px] font-bold" style={{ color: 'var(--scanner-text)' }}>{row.symbol}</span>
                      <span className="text-[9px] ml-1.5" style={{ color: 'var(--scanner-text3)' }}>{row.name}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text2)' }}>
                        ${row.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || '—'}
                      </span>
                    </td>
                    {TIMEFRAMES.map(tf => (
                      <td key={tf} className="py-2 px-3 text-right">
                        <span className="tabular-nums text-[10px] font-semibold" style={{ color: retColor(row[tf]) }}>{fmtRet(row[tf])}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SignalHitRateTable — forward-return hit rates for signal types.
 * Shows what happened 1D/3D/5D after each signal type fired historically.
 */
export function SignalHitRateTable() {
  const snapshot = useSnapshot();
  const sv = snapshot?.signal_verification;

  if (!sv || Object.keys(sv).length === 0) return null;

  const LABELS = {
    ultra6_on: 'Ultra6 ON (allocate)',
    ultra6_off: 'Ultra6 OFF (stablecoins)',
    signal_strong: 'Signal STRONG',
    signal_weak: 'Signal WEAK',
  };

  const HORIZONS = ['1d', '3d', '5d'];

  function fmtHit(v) {
    if (v == null) return '—';
    return v.toFixed(1) + '%';
  }
  function fmtAvg(v) {
    if (v == null) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(2);
  }
  function hitColor(v) {
    if (v == null) return 'var(--scanner-text3)';
    return v >= 55 ? 'var(--scanner-green)' : v <= 45 ? 'var(--scanner-red)' : 'var(--scanner-text2)';
  }

  return (
    <div className="font-mono mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 rounded-full" style={{ background: 'var(--scanner-accent)' }} />
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text3)' }}>
          Signal Hit Rate · Forward Returns After Signal
        </span>
      </div>

      <div className="overflow-x-auto rounded" style={{ border: '1px solid var(--scanner-border2)' }}>
        <table className="board-table w-full border-collapse min-w-[500px]">
          <thead>
            <tr style={{ background: 'var(--scanner-bg2)', borderBottom: '1px solid var(--scanner-border2)' }}>
              <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-left" style={{ color: 'var(--scanner-text3)' }}>Signal</th>
              {HORIZONS.map(h => (
                <React.Fragment key={h}>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-center" style={{ color: 'var(--scanner-text3)' }}>{h.toUpperCase()} Avg</th>
                  <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-center" style={{ color: 'var(--scanner-text3)' }}>{h.toUpperCase()} Hit%</th>
                </React.Fragment>
              ))}
              <th className="text-[8.5px] font-semibold tracking-[0.1em] uppercase py-2.5 px-3 text-center" style={{ color: 'var(--scanner-text3)' }}>N</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sv).map(([key, data]) => {
              if (!data) return null;
              const count = data['1d']?.count || data['3d']?.count || data['5d']?.count || 0;
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--scanner-border)' }}>
                  <td className="py-2.5 px-3">
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--scanner-text)' }}>{LABELS[key] || key}</span>
                  </td>
                  {HORIZONS.map(h => {
                    const d = data[h];
                    return (
                      <React.Fragment key={h}>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] tabular-nums font-semibold" style={{
                            color: d?.avg > 0 ? 'var(--scanner-green)' : d?.avg < 0 ? 'var(--scanner-red)' : 'var(--scanner-text3)',
                          }}>{fmtAvg(d?.avg)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] tabular-nums font-bold" style={{ color: hitColor(d?.hit_rate) }}>
                            {fmtHit(d?.hit_rate)}
                          </span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--scanner-text3)' }}>{count}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[8px] mt-2" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>
        Hit% = % of times forward return was positive after signal fired · Avg = mean forward return
      </div>
    </div>
  );
}
