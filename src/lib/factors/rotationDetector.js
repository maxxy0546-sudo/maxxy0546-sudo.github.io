/**
 * Rotation Detector — generalized from regimeRotation.js
 *
 * Implements factorwatch.ai's 3-session-confirm + 10-session-fresh rotation
 * detection pattern. Works with any {date, leader} or {date, quadrant} shaped
 * history — asset-class-agnostic.
 *
 * The original regimeRotation.js detected macro regime quadrant flips.
 * This generalization works for:
 *   - Crypto factor leadership (momentum vs size vs volatility etc.)
 *   - Equity factor leadership (same factors, different universe)
 *   - Macro regime quadrants (backward compatible)
 *
 * Usage:
 *   const history = loadFactorHistory();  // [{date, leader: 'momentum'}, ...]
 *   const rotation = detectRotation(history);
 *   if (rotation.flipFlag) { ... }
 */

const CONFIRM_SESSIONS = 3;       // new leader must hold this many sessions
const FLIP_FRESH_SESSIONS = 10;   // flag stays visible for this many sessions

/**
 * Detect leadership rotation from a history of daily classifications.
 *
 * Audit (2026-08-29, "Factor Monitor always WAIT"): the previous flip logic
 * was self-contradictory — `flipped` compared TODAY vs YESTERDAY, so it was
 * only true on the literal day of the flip... but `confirmed` additionally
 * required heldSessions >= 3, and heldSessions can only be 1 when today ≠
 * yesterday. `confirmed` was therefore mathematically unreachable (always
 * false), which made every "Rotation confirmed: X → Y" line dead UI and fed
 * the always-WAIT stance chain.
 *
 * Correct semantics, as documented:
 *   - `heldSessions`  — length of the current leader's trailing run.
 *   - `flipped`       — the current leader took over from a DIFFERENT label
 *                       at some point within the visible history (the
 *                       displaced label is `previousLabel`).
 *   - `confirmed`     — flipped AND current leader held >= CONFIRM_SESSIONS
 *                       AND the displaced label had itself held >=
 *                       CONFIRM_SESSIONS (i.e. it was established, so the
 *                       takeover is meaningful, not noise).
 *   - `flipFlag`      — a confirmed flip still within its fresh window
 *                       (heldSessions <= FLIP_FRESH_SESSIONS).
 *
 * @param {Array<{date: string, leader: string}|{date: string, quadrant: string}>} history
 *   - chronological, oldest first
 *   - one entry per session (day)
 *   - 'leader' and 'quadrant' are both accepted as the label key
 *
 * @returns {object} rotation state
 */
export function detectRotation(history) {
  if (!history || history.length < 4) {
    return {
      currentLabel: null,
      previousLabel: null,
      heldSessions: 0,
      flipped: false,
      flipFlag: false,
      flipConfirmedAt: null,
      previousHeldSessions: 0,
      confirmed: false,
      confirmSessions: CONFIRM_SESSIONS,
      freshSessions: FLIP_FRESH_SESSIONS,
    };
  }

  // Extract label from either 'leader' or 'quadrant' key
  const getLabel = (entry) => entry?.leader || entry?.quadrant || null;

  const today = history[history.length - 1];
  const currentLabel = getLabel(today);

  // Walk back to the start of the current label's run.
  let runStart = history.length - 1;
  while (runStart > 0 && getLabel(history[runStart - 1]) === currentLabel) runStart--;
  const heldSessions = history.length - runStart;

  // The displaced label: what the current leader took over from (null when
  // the current label has held for the entire visible history).
  const displacedLabel = runStart > 0 ? getLabel(history[runStart - 1]) : null;
  const flipped = displacedLabel != null && displacedLabel !== currentLabel;

  // How long the displaced label had held before being displaced
  let previousHeldSessions = 0;
  if (flipped) {
    let i = runStart - 1;
    while (i >= 0 && getLabel(history[i]) === displacedLabel) {
      previousHeldSessions++;
      i--;
    }
  }

  // Flip is confirmed only when:
  //   1. Current label has held >= CONFIRM_SESSIONS sessions
  //   2. The displaced label was itself established for >= CONFIRM_SESSIONS
  const confirmed = flipped
    && heldSessions >= CONFIRM_SESSIONS
    && previousHeldSessions >= CONFIRM_SESSIONS;

  // Flag stays "fresh" for FLIP_FRESH_SESSIONS after confirmation
  let flipFlag = false;
  let flipConfirmedAt = null;
  if (confirmed) {
    flipFlag = heldSessions <= FLIP_FRESH_SESSIONS;
    flipConfirmedAt = history[runStart].date;  // first session of the new run
  }

  // previousLabel: what the current leader displaced (for "X → Y" displays).
  // Falls back to the current label when no flip is visible, so consumers
  // rendering "previousLabel → currentLabel" never show a nonsensical pair.
  const previousLabel = flipped ? displacedLabel : currentLabel;

  return {
    currentLabel,
    previousLabel,
    heldSessions,
    flipped,
    flipFlag,
    flipConfirmedAt,
    previousHeldSessions,
    confirmed,
    confirmSessions: CONFIRM_SESSIONS,
    freshSessions: FLIP_FRESH_SESSIONS,
  };
}

/**
 * Build a factor leadership history entry from the current snapshot.
 * Call this once per session and append to a history array.
 *
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {string} leader - the current leading factor name
 * @returns {{date: string, leader: string}}
 */
export function buildHistoryEntry(date, leader) {
  return { date, leader };
}

/**
 * Load factor leadership history from localStorage.
 * Used as a client-side persistence layer (same pattern as trendscan_regime_history).
 *
 * @param {string} key - localStorage key (e.g. 'trendscan_crypto_factor_history')
 * @returns {Array} history array, oldest first
 */
export function loadFactorHistory(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Save factor leadership history to localStorage.
 * Caps at 90 entries (same as trendscan_regime_history).
 *
 * @param {string} key - localStorage key
 * @param {Array} history - history array
 */
export function saveFactorHistory(key, history) {
  try {
    const pruned = history.slice(-90);
    localStorage.setItem(key, JSON.stringify(pruned));
  } catch {
    // localStorage may be full or disabled — silently ignore
  }
}

/**
 * Append today's leader to the history if not already present.
 *
 * @param {Array} history - existing history
 * @param {string} date - today's date (YYYY-MM-DD)
 * @param {string} leader - today's leading factor
 * @returns {Array} updated history (capped at 90 entries)
 */
export function appendToHistory(history, date, leader) {
  if (!leader) return history;
  // Don't duplicate if today's entry already exists
  if (history.length > 0 && history[history.length - 1].date === date) {
    return history;
  }
  const updated = [...history, { date, leader }];
  return updated.slice(-90);
}
