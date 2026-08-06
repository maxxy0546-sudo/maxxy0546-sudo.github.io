/**
 * BoardToolbar.jsx — shared toolbar for Board tabs.
 *
 * Contains:
 *   - ADR window toggle (5/14/20 days, persisted to localStorage)
 *   - Settings gear (opens SettingsModal — client-side personal settings)
 *
 * Placed at the top of the Board tab bar.
 */

import React, { useState, useEffect } from 'react';
import SettingsModal from './SettingsModal';

export default function BoardToolbar({ onAdrWindowChange = null }) {
  const [adrWindow, setAdrWindow] = useState(20);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const savedAdr = parseInt(localStorage.getItem('trendscan_adr_window')) || 20;
    setAdrWindow(savedAdr);
  }, []);

  const changeAdrWindow = (w) => {
    setAdrWindow(w);
    localStorage.setItem('trendscan_adr_window', w);
    onAdrWindowChange?.(w);
  };

  return (
    <>
      <div className="flex items-center gap-3 font-mono">
        {/* ADR window toggle */}
        <div className="adr-toggle" title="ADR calculation window">
          <button className={adrWindow === 5 ? 'active' : ''} onClick={() => changeAdrWindow(5)}>5D</button>
          <button className={adrWindow === 14 ? 'active' : ''} onClick={() => changeAdrWindow(14)}>14D</button>
          <button className={adrWindow === 20 ? 'active' : ''} onClick={() => changeAdrWindow(20)}>20D</button>
        </div>

        {/* Settings gear */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-[10px] font-bold px-2 py-1 rounded transition-all"
          style={{
            background: 'var(--scanner-bg2)',
            border: '1px solid var(--scanner-border2)',
            color: 'var(--scanner-text3)',
            cursor: 'pointer',
          }}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
