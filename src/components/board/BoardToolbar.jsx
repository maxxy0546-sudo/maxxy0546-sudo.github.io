/**
 * BoardToolbar.jsx — shared toolbar for Board tabs.
 *
 * Contains:
 *   - Light/dark theme toggle (persisted to localStorage)
 *   - ADR window toggle (5/14/20 days, persisted to localStorage)
 *   - Settings gear (opens SettingsModal)
 *
 * Placed at the top of each Board tab, or once in the Board header.
 */

import React, { useState, useEffect } from 'react';
import SettingsModal from './SettingsModal';

export default function BoardToolbar({ onAdrWindowChange = null }) {
  const [theme, setTheme] = useState('dark');
  const [adrWindow, setAdrWindow] = useState(20);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('trendscan_theme') || 'dark';
    const savedAdr = parseInt(localStorage.getItem('trendscan_adr_window')) || 20;
    setTheme(savedTheme);
    setAdrWindow(savedAdr);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (t) => {
    if (t === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('trendscan_theme', newTheme);
    applyTheme(newTheme);
  };

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

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="text-[10px] font-bold px-2 py-1 rounded transition-all"
          style={{
            background: 'var(--scanner-bg2)',
            border: '1px solid var(--scanner-border2)',
            color: 'var(--scanner-text3)',
            cursor: 'pointer',
          }}
          title="Toggle light/dark theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

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
