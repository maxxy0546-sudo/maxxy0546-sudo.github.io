/**
 * RegimeCard - Primary regime display card for MMM Macro Suite
 * Shows SPRING/SUMMER/FALL/WINTER + Liquidity overlay
 */

import React, { useState, useEffect } from 'react';
import { detectRegimeRotation } from '@/lib/regime/regimeRotation';
import { useSnapshot } from '@/hooks/useSnapshot';

const SEASON_CONFIG = {
  SPRING: {
    label: 'SPRING',
    season: 'Goldilocks',
    color: 'var(--scanner-green)',
    bg: 'rgba(0,230,118,0.06)',
    border: 'rgba(0,230,118,0.25)',
  },
  SUMMER: {
    label: 'SUMMER',
    season: 'Overheat',
    color: 'var(--scanner-red)',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.25)',
  },
  FALL: {
    label: 'FALL',
    season: 'Stagflation',
    color: '#f5c842',
    bg: 'rgba(245,200,66,0.06)',
    border: 'rgba(245,200,66,0.25)',
  },
  WINTER: {
    label: 'WINTER',
    season: 'Contraction',
    color: 'var(--scanner-blue)',
    bg: 'rgba(77,159,255,0.06)',
    border: 'rgba(77,159,255,0.25)',
  },
  FLUX: {
    label: 'FLUX',
    season: 'Transitional',
    color: 'var(--scanner-text3)',
    bg: 'rgba(156,163,175,0.06)',
    border: 'rgba(156,163,175,0.25)',
  },
};

const LIQ_COLORS = {
  LOOSE: 'var(--scanner-green)',
  NEUTRAL: 'var(--scanner-text2)',
  TIGHT: 'var(--scanner-red)',
};

export default function RegimeCard({ regime }) {
  // Rotation: detect from snapshot.regime_history (server-side, authoritative)
  // + localStorage (today's intraday entry). Previously only read localStorage,
  // which meant rotation detection only worked for days the user visited the
  // page. Now reads server-side 90-day history so rotation works even after
  // a multi-day absence.
  //
  // Hooks MUST be called before any early return (rules of hooks).
  const snapshot = useSnapshot();
  const [rotationInfo, setRotationInfo] = useState(null);
  useEffect(() => {
    try {
      const serverHistory = snapshot?.regime_history || [];
      const localHistory = JSON.parse(localStorage.getItem('trendscan_regime_history') || '[]');
      // Merge: server is authoritative; add today's local entry if not in server
      const today = new Date().toISOString().split('T')[0];
      const serverHasToday = serverHistory.some(h => h.date === today);
      const localToday = localHistory.find(h => h.date === today);
      const merged = serverHasToday || !localToday
        ? serverHistory
        : [...serverHistory, localToday];
      if (Array.isArray(merged) && merged.length >= 4) {
        setRotationInfo(detectRegimeRotation(merged));
      }
    } catch {}
  }, [snapshot]);

  if (!regime) {
    return (
      <div
        className="rounded-lg p-5 border"
        style={{ background: 'var(--scanner-bg2)', borderColor: 'var(--scanner-border2)' }}
      >
        <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--scanner-text3)' }}>
          MACRO REGIME
        </div>
        <div className="text-center py-8" style={{ color: 'var(--scanner-text3)' }}>
          Loading regime data...
        </div>
      </div>
    );
  }

  const {
    quadrant = 'FLUX',
    liquidity = 'NEUTRAL',
    grandComposite = 50,
    growth = {},
    inflation = {},
    liquidity: liqData = {},
    lastUpdated = null,
    fredAvailable = true,
  } = regime;

  const seasonConfig = SEASON_CONFIG[quadrant] || SEASON_CONFIG.FLUX;
  const liqColor = LIQ_COLORS[liquidity] || LIQ_COLORS.NEUTRAL;

  // Next scheduled snapshot refresh.
  // The Cloudflare Worker cron triggers refresh-snapshot.yml every 4 hours
  // at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC (7 days/week).
  // GitHub Actions cron is the backup (same schedule). Compute the next
  // upcoming run from now.
  function nextRefreshTime() {
    const now = new Date();
    const UTC_HOURS = [0, 4, 8, 12, 16, 20]; // Cloudflare Worker cron, 7 days/week
    for (let d = 0; d < 3; d++) {  // search up to 3 days ahead (overkill, but safe)
      for (const hr of UTC_HOURS) {
        const candidate = new Date(now);
        candidate.setUTCDate(now.getUTCDate() + d);
        candidate.setUTCHours(hr, 0, 0, 0);
        if (candidate.getTime() > now.getTime()) {
          return candidate;
        }
      }
    }
    return null;
  }
  const nextExec = nextRefreshTime();

  return (
    <div
      className="rounded-lg p-5"
      style={{
        background: seasonConfig.bg,
        border: `1px solid ${seasonConfig.border}`,
      }}
    >
      {/* Header */}
      <div className="text-[9px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--scanner-text3)' }}>
        MACRO REGIME
      </div>

      {/* Season Label */}
      <div className="mb-3">
        <div className="text-[24px] font-bold mb-0.5" style={{ color: 'var(--scanner-accent)' }}>
          {seasonConfig.label}
        </div>
        <div className="text-[11px]" style={{ color: seasonConfig.color }}>
          {seasonConfig.season} + {liquidity}
        </div>
      </div>

      {/* Grand Composite */}
      <div className="mb-4">
        <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: 'var(--scanner-text3)' }}>
          Grand Composite
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-bold tabular-nums" style={{ color: seasonConfig.color }}>
            {grandComposite.toFixed(1)}
          </span>
          <span className="text-[14px]" style={{ color: 'var(--scanner-text3)' }}>/100</span>
        </div>
        {/* Nowcast bar */}
        <div className="h-1.5 rounded-sm mt-2 overflow-hidden" style={{ background: 'var(--scanner-border2)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(100, grandComposite)}%`,
              background: seasonConfig.color,
            }}
          />
        </div>
      </div>

      {/* Z-Scores Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--scanner-text3)' }}>
            Macro z
          </div>
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: growth.meZ > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}
          >
            {growth.meZ > 0 ? '+' : ''}{growth.meZ?.toFixed(2) ?? '0.00'}
          </span>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--scanner-text3)' }}>
            Impulse z
          </div>
          <span
            className="text-[14px] font-bold tabular-nums"
            style={{ color: growth.impulseZ > 0 ? 'var(--scanner-green)' : 'var(--scanner-red)' }}
          >
            {growth.impulseZ > 0 ? '+' : ''}{growth.impulseZ?.toFixed(2) ?? '0.00'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t my-4" style={{ borderColor: 'var(--scanner-border2)' }} />

      {/* Footer info */}
      <div className="space-y-1 text-[8px]" style={{ color: 'var(--scanner-text3)' }}>
        {lastUpdated && (
          <div>Updated: {new Date(lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        )}
        <div>Next data refresh: {nextExec ? nextExec.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '—'}</div>
        <div style={{ opacity: 0.6 }}>
          {fredAvailable ? (
            <span>via FRED + Binance + Kraken</span>
          ) : (
            <span>Crypto-native signals only</span>
          )}
        </div>
      </div>
    </div>
  );
}
