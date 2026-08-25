/**
 * useSnapshot — shared hook for reading the pre-built /snapshot.json
 *
 * Audit F-14-g-2 (2026-08-26): previously _snapshotCache was set once
 * per page-load and never invalidated. Combined with GitHub Pages' 10-min
 * HTTP cache, long-session users saw stale snapshot indefinitely — even
 * after the 4h GHA rebuild ran, the in-memory cache kept serving the
 * pre-rebuild data. Now:
 *   - In-memory cache TTL: 5 min (so even long sessions refresh)
 *   - Document visibilitychange listener: refetch when tab becomes
 *     visible again (user returns to the tab after backgrounding)
 *   - Deduplication via _fetchPromise preserved (no duplicate fetches)
 *
 * Worst-case staleness: 10min (GitHub Pages HTTP cache) + 5min (in-mem
 * TTL) = 15min, then refetched on next render. Acceptable for a 4h-
 * rebuild cycle.
 */

import { useEffect, useState } from 'react';

let _snapshotCache = null;
let _snapshotCacheTime = 0;
let _fetchPromise = null;

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;  // 5 minutes

async function fetchSnapshot(force = false) {
  const now = Date.now();
  // Cache hit only if both: cache exists AND TTL hasn't expired AND not forced.
  if (!force && _snapshotCache && (now - _snapshotCacheTime) < SNAPSHOT_TTL_MS) {
    return _snapshotCache;
  }
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetch('/snapshot.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      _snapshotCache = d;
      _snapshotCacheTime = Date.now();
      _fetchPromise = null;
      return d;
    })
    .catch(() => { _fetchPromise = null; return null; });
  return _fetchPromise;
}

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState(_snapshotCache);

  useEffect(() => {
    const now = Date.now();
    const cacheFresh = _snapshotCache && (now - _snapshotCacheTime) < SNAPSHOT_TTL_MS;
    if (cacheFresh) {
      setSnapshot(_snapshotCache);
    } else {
      fetchSnapshot().then(setSnapshot);
    }

    // Refetch when the tab becomes visible again (e.g. user returns
    // from another tab after backgrounding this one). Catches the case
    // where the user left the tab open for 30 min, the GHA rebuild ran
    // in the background, and they come back — we want them to see the
    // fresh data, not the stale in-memory cache.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSnapshot(true).then(setSnapshot);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return snapshot;
}

export function useSnapshotKey(key) {
  const snapshot = useSnapshot();
  if (!snapshot) return undefined;
  return snapshot[key] ?? null;
}

export function clearSnapshotCache() {
  _snapshotCache = null;
  _snapshotCacheTime = 0;
  _fetchPromise = null;
}
