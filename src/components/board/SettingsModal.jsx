/**
 * SettingsModal.jsx — Board settings modal.
 *
 * Configurable thresholds:
 *   - MA periods (10/20/21/50/200 checkboxes)
 *   - Big-move threshold (breadth)
 *   - Extension cutoff (too hot ATR)
 *   - Clean momentum filters (ATR range, vol ratio, 5D return)
 *   - Crypto-specific thresholds (wider ranges)
 *
 * Reads from config/settings.json (server-side, read-only display).
 * Settings changes require a commit + deploy (documented in modal).
 */

import React, { useState, useEffect } from 'react';
import { loadSettings } from '@/lib/config/settingsLoader';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [activeSection, setActiveSection] = useState('general');

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!settings) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
        <div className="font-mono p-8" style={{ background: 'var(--scanner-bg1)', border: '1px solid var(--scanner-border2)' }} onClick={e => e.stopPropagation()}>
          <span style={{ color: 'var(--scanner-text3)' }}>Loading settings…</span>
        </div>
      </div>
    );
  }

  const sections = [
    { key: 'general', label: 'General' },
    { key: 'extension', label: 'Extension' },
    { key: 'crypto', label: 'Crypto' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--scanner-bg1)', border: '1px solid var(--scanner-border3)', maxWidth: '560px', width: '90vw', maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="card-head-grad flex items-center justify-between px-5 py-3" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: 'var(--scanner-text)' }}>Settings</span>
          <button onClick={onClose} className="text-[14px]" style={{ color: 'var(--scanner-text3)', cursor: 'pointer', background: 'none', border: 'none' }}>✕</button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {sections.map(s => (
            <button key={s.key}
              className="text-[9px] font-bold px-3 py-1.5"
              style={{
                background: activeSection === s.key ? 'rgba(245,158,11,0.12)' : 'var(--scanner-bg2)',
                border: `1px solid ${activeSection === s.key ? 'var(--scanner-accent)' : 'var(--scanner-border2)'}`,
                color: activeSection === s.key ? 'var(--scanner-accent)' : 'var(--scanner-text3)',
                cursor: 'pointer',
              }}
              onClick={() => setActiveSection(s.key)}
            >{s.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {activeSection === 'general' && (
            <>
              <SettingRow label="MA Periods" value={settings.metrics?.ma_periods?.join(', ')} />
              <SettingRow label="Available MAs" value={settings.metrics?.available_ma_periods?.join(', ')} />
              <SettingRow label="Return Periods" value={settings.metrics?.return_periods?.join(', ')} />
              <SettingRow label="Big-Move Threshold" value={`${(settings.breadth?.big_move_threshold * 100).toFixed(0)}%`} />
              <SettingRow label="Theme Min Names" value={settings.theme_scoring?.min_names} />
              <SettingRow label="Theme Weights" value={`B${(settings.theme_scoring?.weights?.breadth * 100).toFixed(0)}% L${(settings.theme_scoring?.weights?.leadership * 100).toFixed(0)}% M${(settings.theme_scoring?.weights?.momentum * 100).toFixed(0)}% RS${(settings.theme_scoring?.weights?.relative_strength * 100).toFixed(0)}%`} />
            </>
          )}

          {activeSection === 'extension' && (
            <>
              <SettingRow label="Too Hot ATR Threshold" value={settings.extension?.too_hot_atr_threshold} />
              <SettingRow label="Clean Momentum ATR Min" value={settings.extension?.clean_momentum_atr_min} />
              <SettingRow label="Clean Momentum ATR Max" value={settings.extension?.clean_momentum_atr_max} />
              <SettingRow label="Clean Momentum Min Vol Ratio" value={settings.extension?.clean_momentum_min_vol_ratio} />
              <SettingRow label="Clean Momentum Min 5D Return" value={`${(settings.extension?.clean_momentum_min_ret_5d * 100).toFixed(0)}%`} />
              <SettingRow label="Momentum Scale" value={`[${(settings.theme_scoring?.momentum_scale?.low * 100).toFixed(0)}%, ${(settings.theme_scoring?.momentum_scale?.high * 100).toFixed(0)}%]`} />
              <SettingRow label="RS Scale Factor" value={settings.theme_scoring?.rs_scale_factor} />
            </>
          )}

          {activeSection === 'crypto' && (
            <>
              <SettingRow label="Crypto Momentum Scale" value={`[${(settings.crypto?.theme_scoring?.momentum_scale?.low * 100).toFixed(0)}%, ${(settings.crypto?.theme_scoring?.momentum_scale?.high * 100).toFixed(0)}%]`} />
              <SettingRow label="Crypto Too Hot ATR" value={settings.crypto?.extension?.too_hot_atr_threshold} />
              <SettingRow label="Crypto Clean Momentum ATR Max" value={settings.crypto?.extension?.clean_momentum_atr_max} />
              <SettingRow label="Crypto Big-Move Threshold" value={`${(settings.crypto?.breadth?.big_move_threshold * 100).toFixed(0)}%`} />
              <SettingRow label="Crypto Fading Threshold" value={`${(settings.crypto?.fading_threshold * 100).toFixed(0)}%`} />
            </>
          )}

          {/* Info note */}
          <div className="mt-4 p-3 rounded text-[9px]" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)', color: 'var(--scanner-text3)' }}>
            <strong style={{ color: 'var(--scanner-text2)' }}>Note:</strong> Settings are configured server-side in
            <code style={{ color: 'var(--scanner-accent)' }}> config/settings.json</code>.
            Changes require a commit + deploy. Use the ADR window toggle to switch ADR lookback on the fly.
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--scanner-border)' }}>
      <span className="text-[10px]" style={{ color: 'var(--scanner-text3)' }}>{label}</span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--scanner-text2)' }}>{value ?? '—'}</span>
    </div>
  );
}
