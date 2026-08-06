/**
 * SettingsModal.jsx — Board personal settings (client-side, per-browser).
 *
 * Settings are saved to localStorage('trendscan_board_settings') and apply
 * only to the user's browser. No server-side config needed.
 *
 * Configurable:
 *   - Too Hot ATR threshold (how many ATRs above 50DMA = "too hot")
 *   - Clean Momentum ATR range (min/max for clean momentum filter)
 *   - Clean Momentum min volume ratio
 *   - Clean Momentum min 5D return
 *   - Big-move threshold (what counts as a "big" up/down day for breadth)
 *   - Fading threshold (5D return below this = "fading")
 *
 * These override the defaults from config/settings.json for this browser only.
 * The Board scoring functions read from localStorage at runtime.
 */

import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'trendscan_board_settings';

// Default values (match config/settings.json)
const DEFAULTS = {
  tooHotAtr: 8.0,
  cleanAtrMin: 1.0,
  cleanAtrMax: 5.0,
  cleanMinVol: 1.0,
  cleanMinRet5d: 0,
  bigMovePct: 4,
  fadingThreshold: -3,
  // Crypto-specific
  cryptoTooHotAtr: 12.0,
  cryptoCleanAtrMax: 8.0,
  cryptoBigMovePct: 8,
  cryptoFadingThreshold: -5,
};

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULTS };
}

function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function getBoardSettings() {
  return loadSettings();
}

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [activeSection, setActiveSection] = useState('extension');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    saveSettings({ ...DEFAULTS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { key: 'extension', label: 'Extension' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'breadth', label: 'Breadth' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--scanner-bg1)', border: '1px solid var(--scanner-border3)', maxWidth: '480px', width: '90vw', maxHeight: '80vh', overflow: 'auto' }}
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
        <div className="p-5 space-y-3">
          {activeSection === 'extension' && (
            <>
              <NumberInput label="Too Hot ATR Threshold" value={settings.tooHotAtr} onChange={v => update('tooHotAtr', v)} step={0.5} min={1} max={20} hint="ATRs above 50DMA to qualify as 'too hot' (chase risk)" />
              <NumberInput label="Clean Momentum ATR Min" value={settings.cleanAtrMin} onChange={v => update('cleanAtrMin', v)} step={0.5} min={0} max={10} />
              <NumberInput label="Clean Momentum ATR Max" value={settings.cleanAtrMax} onChange={v => update('cleanAtrMax', v)} step={0.5} min={1} max={15} />
              <NumberInput label="Clean Momentum Min Vol Ratio" value={settings.cleanMinVol} onChange={v => update('cleanMinVol', v)} step={0.1} min={0} max={5} />
              <NumberInput label="Clean Momentum Min 5D Return (%)" value={settings.cleanMinRet5d * 100} onChange={v => update('cleanMinRet5d', v / 100)} step={1} min={-20} max={20} />
              <NumberInput label="Fading Threshold (%)" value={settings.fadingThreshold} onChange={v => update('fadingThreshold', v)} step={1} min={-20} max={0} hint="5D return below this = 'fading'" />
            </>
          )}

          {activeSection === 'crypto' && (
            <>
              <NumberInput label="Crypto Too Hot ATR" value={settings.cryptoTooHotAtr} onChange={v => update('cryptoTooHotAtr', v)} step={1} min={4} max={25} hint="Crypto is 2-3x more volatile than equities" />
              <NumberInput label="Crypto Clean Momentum ATR Max" value={settings.cryptoCleanAtrMax} onChange={v => update('cryptoCleanAtrMax', v)} step={1} min={3} max={15} />
              <NumberInput label="Crypto Big-Move Threshold (%)" value={settings.cryptoBigMovePct} onChange={v => update('cryptoBigMovePct', v)} step={1} min={2} max={20} />
              <NumberInput label="Crypto Fading Threshold (%)" value={settings.cryptoFadingThreshold} onChange={v => update('cryptoFadingThreshold', v)} step={1} min={-20} max={0} />
            </>
          )}

          {activeSection === 'breadth' && (
            <>
              <NumberInput label="Big-Move Threshold (%)" value={settings.bigMovePct} onChange={v => update('bigMovePct', v)} step={0.5} min={1} max={20} hint="Daily move above this = 'big up/down' in breadth counts" />
            </>
          )}

          {/* Note */}
          <div className="mt-3 p-3 rounded text-[9px]" style={{ background: 'var(--scanner-bg2)', border: '1px solid var(--scanner-border2)', color: 'var(--scanner-text3)' }}>
            Settings are saved to your browser only (localStorage) and apply to your personal experience. They do not affect other users.
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-3" style={{ borderTop: '1px solid var(--scanner-border2)', background: 'var(--scanner-bg2)' }}>
          <button onClick={handleReset} className="text-[9px] font-bold px-3 py-1.5" style={{ background: 'var(--scanner-bg3)', border: '1px solid var(--scanner-border2)', color: 'var(--scanner-text3)', cursor: 'pointer' }}>
            RESET TO DEFAULTS
          </button>
          <button onClick={handleSave} className="text-[9px] font-bold px-4 py-1.5 rounded" style={{ background: saved ? 'var(--scanner-green)' : 'var(--scanner-accent)', color: '#0a0d14', border: 'none', cursor: 'pointer' }}>
            {saved ? '✓ SAVED' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, step = 1, min, max, hint = null }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px]" style={{ color: 'var(--scanner-text3)' }}>{label}</span>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="font-mono text-[11px] px-2 py-1 text-right outline-none"
          style={{
            background: 'var(--scanner-bg2)',
            border: '1px solid var(--scanner-border2)',
            color: 'var(--scanner-text)',
            width: '80px',
            borderRadius: '2px',
          }}
        />
      </div>
      {hint && <div className="text-[8px]" style={{ color: 'var(--scanner-text3)', opacity: 0.7 }}>{hint}</div>}
    </div>
  );
}
