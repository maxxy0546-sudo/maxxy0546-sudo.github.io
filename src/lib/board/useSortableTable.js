/**
 * useSortableTable — React hook for click-column-to-sort on Board tables.
 *
 * Usage:
 *   const { sorted, sortCol, sortDir, handleSort } = useSortableTable(data, 'score', 'desc');
 *   // In <th onClick={() => handleSort('symbol')}> with className based on sortCol/sortDir
 *   // sorted = sorted copy of data
 */

import { useState, useMemo, useCallback } from 'react';
import { sortRows } from './tableUtils';

/**
 * @param {Array} data — array of row objects
 * @param {string} initialSortCol — key to sort by initially
 * @param {'asc'|'desc'} initialDir — initial sort direction
 * @returns {{ sorted, sortCol, sortDir, handleSort, getSortClass }}
 */
export function useSortableTable(data, initialSortCol = null, initialDir = 'desc') {
  const [sortCol, setSortCol] = useState(initialSortCol);
  const [sortDir, setSortDir] = useState(initialDir);

  const handleSort = useCallback((col) => {
    if (sortCol === col) {
      // Toggle direction
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      // Default to desc for numbers, asc for strings
      setSortDir('desc');
    }
  }, [sortCol]);

  const sorted = useMemo(() => {
    if (!sortCol) return data;
    return sortRows(data, row => row[sortCol], sortDir);
  }, [data, sortCol, sortDir]);

  const getSortClass = useCallback((col) => {
    if (sortCol !== col) return '';
    return sortDir === 'desc' ? 'sort-desc' : 'sort-asc';
  }, [sortCol, sortDir]);

  return { sorted, sortCol, sortDir, handleSort, getSortClass };
}
