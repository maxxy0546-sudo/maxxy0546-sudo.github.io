/**
 * CopyCsvButtons.jsx — COPY + CSV button pair for Board tables.
 *
 * Usage:
 *   <CopyCsvButtons tableId="theme-scores-table" />
 *
 * Place inside a SectionLabel's `right` prop or next to table headers.
 * Uses tableUtils to extract tickers and convert table to CSV.
 */

import React, { useRef } from 'react';
import { extractTickers, copyToClipboard, tableToCsv, downloadCsv, flashButton } from '@/lib/board/tableUtils';

export default function CopyCsvButtons({ tableId }) {
  const copyBtnRef = useRef(null);
  const csvBtnRef = useRef(null);

  const handleCopy = async () => {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tickers = extractTickers(/** @type {HTMLTableElement} */ (table));
    if (tickers.length === 0) {
      flashButton(copyBtnRef.current, 'is-error', 'NO TICKERS', 1600);
      return;
    }
    const ok = await copyToClipboard(tickers.join(','));
    if (ok) {
      flashButton(copyBtnRef.current, 'is-copied', `COPIED ${tickers.length}`, 1600);
    } else {
      flashButton(copyBtnRef.current, 'is-error', 'FAILED', 1600);
    }
  };

  const handleCsv = () => {
    const table = document.getElementById(tableId);
    if (!table) return;
    const csv = tableToCsv(/** @type {HTMLTableElement} */ (table));
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`${tableId.replace(/-table$/, '')}_${date}.csv`, csv);
    flashButton(csvBtnRef.current, 'is-copied', 'DOWNLOADING', 1600);
  };

  return (
    <div className="flex gap-1">
      <button ref={copyBtnRef} className="copy-csv-btn" onClick={handleCopy} title="Copy all tickers as comma-separated list">COPY</button>
      <button ref={csvBtnRef} className="copy-csv-btn" onClick={handleCsv} title="Download table as CSV">CSV</button>
    </div>
  );
}
