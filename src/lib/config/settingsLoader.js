/**
 * settingsLoader.js — server-side configuration loader.
 *
 * Reads config/settings.json (committed to repo) and makes it available
 * to the frontend. This is a server-side config (not per-user localStorage)
 * — the same settings apply to all users.
 *
 * The settings.json file is fetched at runtime from /config/settings.json
 * (copied to public/ during build). Changes require a commit + deploy.
 *
 * If the fetch fails (e.g. during development), falls back to DEFAULTS.
 */

const DEFAULTS = {
  metrics: {
    ma_periods: [20, 50, 200],
    available_ma_periods: [10, 20, 21, 50, 200],
    return_periods: [1, 5, 20, 60],
  },
  breadth: {
    big_move_threshold: 0.04,
  },
  extension: {
    too_hot_atr_threshold: 8.0,
    clean_momentum_atr_min: 1.0,
    clean_momentum_atr_max: 5.0,
    clean_momentum_min_vol_ratio: 1.0,
    clean_momentum_min_ret_5d: 0.0,
  },
  scanner: {
    rvol_min_ratio: 1.5,
    rvol_min_dollar_vol: 0,
    rvol_top_n: 50,
    gap_min_pct: 2.0,
    momentum_top_n: 25,
    momentum_min_dollar_vol: 100000000,
  },
  theme_scoring: {
    min_names: 3,
    weights: {
      breadth: 0.30,
      leadership: 0.25,
      momentum: 0.30,
      relative_strength: 0.15,
    },
    momentum_scale: { low: -0.10, high: 0.15 },
    rs_scale_factor: 500,
  },
};

let _cached = null;
let _fetchPromise = null;

export async function loadSettings() {
  if (_cached) return _cached;
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const res = await fetch('/config/settings.json');
      if (res.ok) {
        const data = await res.json();
        _cached = deepMerge(DEFAULTS, data);
        return _cached;
      }
    } catch (e) {
      console.warn('[settingsLoader] Failed to load config/settings.json, using defaults:', e.message);
    }
    _cached = DEFAULTS;
    return _cached;
  })();

  return _fetchPromise;
}

export function getSettings() {
  return _cached || DEFAULTS;
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      out[k] = deepMerge(a[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
