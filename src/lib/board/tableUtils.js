/**
 * tableUtils.js — shared table utilities for Board tabs.
 *
 * Ported from SMB (Stable Market Board) frontend/app.js:
 *   - heatClass(v, scale) — graduated 7-step color class
 *   - scoreClass(s) — 7-tier score coloring
 *   - atrClass(v) — 4-tier ATR extension coloring
 *   - statusClass(status) — status badge class name
 *   - tierClass(tier) — tier badge class name
 *   - sortParse(text) — parse cell text to number or string for sorting
 *   - sortTable(rows, colIndex, direction) — generic column sort
 *   - extractTickers(tableEl) — extract tickers from a table's tbody
 *   - copyToClipboard(text) — clipboard with fallback
 *   - tableToCsv(tableEl) — convert table to CSV string
 *   - downloadCsv(filename, csv) — trigger CSV download
 */

// ── Heat scale helpers ───────────────────────────────────────────────────────

const HEAT_THRESHOLDS = {
  pct:     { t1: 0.005, t2: 0.02, t3: 0.05 },      // standard returns
  pct_big: { t1: 0.01, t2: 0.05, t3: 0.15 },        // crypto returns (wider)
  rs:      { t1: 0.01, t2: 0.03, t3: 0.08 },         // relative strength
};

/**
 * Get heat-scale CSS class for a value.
 * @param {number} v — the value (decimal, e.g. 0.05 = 5%)
 * @param {'pct'|'pct_big'|'rs'} scale — which threshold set to use
 * @returns {string} CSS class name (h-pos-3, h-neg-2, h-neu, etc.)
 */
export function heatClass(v, scale = 'pct') {
  if (v == null || !Number.isFinite(v)) return 'h-neu';
  const { t1, t2, t3 } = HEAT_THRESHOLDS[scale] || HEAT_THRESHOLDS.pct;
  if (v >= t3) return 'h-pos-3';
  if (v >= t2) return 'h-pos-2';
  if (v >= t1) return 'h-pos-1';
  if (v <= -t3) return 'h-neg-3';
  if (v <= -t2) return 'h-neg-2';
  if (v <= -t1) return 'h-neg-1';
  return 'h-neu';
}

/**
 * Get score CSS class (7-tier).
 * @param {number} s — score 0-100
 * @returns {string} CSS class name (s-90, s-75, s-60, s-45, s-30, s-15, s-00)
 */
export function scoreClass(s) {
  if (s == null) return 's-45';
  if (s >= 90) return 's-90';
  if (s >= 75) return 's-75';
  if (s >= 60) return 's-60';
  if (s >= 45) return 's-45';
  if (s >= 30) return 's-30';
  if (s >= 15) return 's-15';
  return 's-00';
}

/**
 * Get ATR extension CSS class (4-tier).
 * @param {number} v — ATR ext from 50DMA
 * @returns {string} CSS class name (atr-hot, atr-warm, atr-cool, atr-cold)
 */
export function atrClass(v) {
  if (v == null) return 'atr-cool';
  if (v >= 8) return 'atr-hot';
  if (v >= 5) return 'atr-warm';
  if (v <= -3) return 'atr-cold';
  return 'atr-cool';
}

/**
 * Get status badge CSS class.
 * @param {string} status — status label (DOMINANT, STRONG, EMERGING, etc.)
 * @returns {string} CSS class name
 */
export function statusClass(status) {
  if (!status) return 'status-NEUTRAL';
  return 'status-' + status.replace(/[\/ ]/g, '-');
}

/**
 * Get tier badge CSS class.
 * @param {string} tier — tier name (Core, Active, Watch)
 * @returns {string} CSS class name
 */
export function tierClass(tier) {
  if (!tier) return '';
  return 'tier-' + tier;
}

// ── Sorting helpers ──────────────────────────────────────────────────────────

/**
 * Parse cell text content to a sortable value.
 * Handles $B/$M/$K suffixes, %, +/-, σ, x multipliers, and plain numbers.
 * Returns null for blanks/—, numbers for numeric, lowercase string for text.
 *
 * @param {string} text — cell text content
 * @returns {number|string|null}
 */
export function sortParse(text) {
  const t = (text || '').replace(/▲|▼/g, '').trim();
  if (!t || t === '—' || t === '-') return null;
  const cleaned = t.replace(/[,$\s]/g, '');
  const m = cleaned.match(/^[+\-]?\d*\.?\d+/);
  if (m && m[0] !== '' && m[0] !== '+' && m[0] !== '-') {
    let v = parseFloat(m[0]);
    const rest = cleaned.slice(m[0].length).toUpperCase();
    if (rest.startsWith('B')) v *= 1e9;
    else if (rest.startsWith('M')) v *= 1e6;
    else if (rest.startsWith('K')) v *= 1e3;
    return v;
  }
  return t.toLowerCase();
}

/**
 * Sort an array of row data by a given key accessor.
 * Blanks/nulls always sink to the bottom regardless of direction.
 *
 * @param {Array} rows — array of row objects
 * @param {Function} accessor — (row) => sortable value
 * @param {'asc'|'desc'} direction
 * @returns {Array} sorted copy
 */
export function sortRows(rows, accessor, direction = 'desc') {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    // Blanks sink to bottom
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return direction === 'desc' ? bv - av : av - bv;
    }
    const cmp = String(av).localeCompare(String(bv));
    return direction === 'desc' ? -cmp : cmp;
  });
  return sorted;
}

// ── Copy / CSV helpers ───────────────────────────────────────────────────────

/**
 * Extract tickers from a table element's tbody.
 * Looks for the first cell in each row, extracts the ticker text.
 *
 * @param {HTMLTableElement} tableEl
 * @returns {string[]} array of ticker symbols
 */
export function extractTickers(tableEl) {
  if (!tableEl) return [];
  const tickers = [];
  const rows = tableEl.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const firstCell = row.querySelector('td');
    if (!firstCell) return;
    // Try to find a bold/strong element first (usually the ticker)
    const tickerEl = firstCell.querySelector('.font-bold, strong, b') || firstCell;
    const text = tickerEl.textContent.trim();
    if (text && text !== '—' && text.length <= 10) {
      tickers.push(text);
    }
  });
  return [...new Set(tickers)]; // dedupe
}

/**
 * Copy text to clipboard with fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: legacy textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Convert a table element to CSV string.
 * Reads <thead th> for headers, <tbody tr> for rows.
 * Strips extra whitespace, quotes fields containing commas/quotes/newlines.
 *
 * @param {HTMLTableElement} tableEl
 * @returns {string} CSV string
 */
export function tableToCsv(tableEl) {
  if (!tableEl) return '';
  const esc = (s) => {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const lines = [];

  // Headers
  const headers = [];
  tableEl.querySelectorAll('thead th').forEach(th => {
    headers.push(esc(th.textContent.replace(/▲|▼/g, '').trim()));
  });
  if (headers.length) lines.push(headers.join(','));

  // Rows
  tableEl.querySelectorAll('tbody tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('td').forEach(td => {
      cells.push(esc(td.textContent.trim()));
    });
    if (cells.length) lines.push(cells.join(','));
  });

  return lines.join('\n');
}

/**
 * Trigger a CSV file download.
 * @param {string} filename
 * @param {string} csv
 */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * Flash a button to show copy/CSV success.
 * @param {HTMLElement} btn
 * @param {string} flashClass — CSS class to add temporarily
 * @param {string} flashText — text to show
 * @param {number} duration — ms
 */
export function flashButton(btn, flashClass, flashText, duration = 1600) {
  if (!btn) return;
  const origText = btn.textContent;
  btn.textContent = flashText;
  btn.classList.add(flashClass);
  setTimeout(() => {
    btn.textContent = origText;
    btn.classList.remove(flashClass);
  }, duration);
}
