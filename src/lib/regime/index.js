export { buildRegimeSignals, computeRegime, REGIME_LABELS, scoreToGauge } from './regimeEngine.js';
// Audit F-14-d-9 (2026-08-26): removed `export { getRegimeData, buildRegimeHistory,
// REGIME_INDICATORS, getSignalColor } from './regimeData.js';` — regimeData.js was
// dead code (zero callers across src/; REGIME_INDICATORS + getSignalColor were
// only used by IndicatorList.jsx which was itself dead). File deleted.