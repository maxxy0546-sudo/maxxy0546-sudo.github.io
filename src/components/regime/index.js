export { default as RegimeCard } from './RegimeCard.jsx';
export { default as CompositeGauge } from './CompositeGauge.jsx';
// Audit F-14-d-10 (2026-08-26): RegimeHistory.jsx + IndicatorList.jsx removed —
// zero callers across src/. They were demo components from the mock-data era
// (used to render buildRegimeHistory's Math.random output, also deleted).