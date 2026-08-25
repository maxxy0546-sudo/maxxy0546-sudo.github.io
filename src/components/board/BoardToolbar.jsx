/**
 * BoardToolbar.jsx — shared toolbar for Board tabs.
 *
 * Contains:
 *   - ADR window toggle (5/14/20 days, persisted to localStorage)
 *
 * Audit F-14-f-7 (2026-08-26): the Settings gear + SettingsModal were
 * removed — SettingsModal saved user thresholds to localStorage but the
 * scoring functions (tradfiScoring.js EXTENSION_CONFIG, cryptoScoring.js
 * CRYPTO_EXTENSION_CONFIG) were hardcoded constants that never read those
 * saved values, making the modal's "✓ SAVED" UX misleading. The scoring
 * defaults are now honestly hardcoded; if user-tunable thresholds are
 * re-introduced, wire getBoardSettings() into getExtensionLists /
 * getCryptoExtensionLists at that time (see audit §7.6).
 *
 * Placed at the top of the Board tab bar.
 */

import React, { useState, useEffect } from 'react';

export default function BoardToolbar({ onAdrWindowChange = null }) {
  const [adrWindow, setAdrWindow] = useState(20);

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
      </div>
    </>
  );
}
