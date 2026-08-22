/**
 * ScrollingTicker — horizontally scrolling price marquee for major assets.
 *
 * Fetches live prices from OKX SWAP perps (single batch API call, CORS-enabled,
 * free, no API key). Polls every 5s — well within OKX's rate limit (20 req/2s
 * per IP for the /market/tickers endpoint = 600 req/min; we use 12 req/min).
 *
 * Tickers displayed (10):
 *   BTC, ETH, SOL, HYPE  — crypto majors
 *   SPY, QQQ             — equity indices (OKX tokenized stock perps)
 *   DRAM, SOXL           — sector ETFs (memory + semiconductors)
 *   CL                   — crude oil (WTI futures perp)
 *   XAU                  — gold (spot perp)
 *
 * The marquee uses CSS @keyframes animation (GPU-friendly, no JS render loop).
 * Pauses on hover so users can read a specific price.
 *
 * Data source: OKX /api/v5/market/tickers?instType=SWAP
 *   Returns all SWAP tickers in one call (~446 instruments). We filter to our 8.
 *   Fields used: instId, last (price), open24h (for % change calc).
 */

import React, { useState, useEffect, useRef } from 'react';
import { fetchWithTimeout } from '@/lib/scanner/fetchWithTimeout';

// OKX SWAP instIds for the tickers we display.
const TICKER_INST_IDS = [
  { instId: 'BTC-USDT-SWAP',  symbol: 'BTC',  label: 'BTC',   category: 'crypto' },
  { instId: 'ETH-USDT-SWAP',  symbol: 'ETH',  label: 'ETH',   category: 'crypto' },
  { instId: 'SOL-USDT-SWAP',  symbol: 'SOL',  label: 'SOL',   category: 'crypto' },
  { instId: 'HYPE-USDT-SWAP', symbol: 'HYPE', label: 'HYPE',  category: 'crypto' },
  { instId: 'LIT-USDT-SWAP',   symbol: 'LIT',  label: 'LIT',   category: 'crypto' },
  { instId: 'PUMP-USDT-SWAP',  symbol: 'PUMP', label: 'PUMP',  category: 'crypto' },
  { instId: 'AAVE-USDT-SWAP',  symbol: 'AAVE', label: 'AAVE',  category: 'crypto' },
  { instId: 'NEAR-USDT-SWAP',  symbol: 'NEAR', label: 'NEAR',  category: 'crypto' },
  { instId: 'DOGE-USDT-SWAP',  symbol: 'DOGE', label: 'DOGE',  category: 'crypto' },
  { instId: 'SPY-USDT-SWAP',  symbol: 'SPY',  label: 'SPY',   category: 'index'  },
  { instId: 'QQQ-USDT-SWAP',  symbol: 'QQQ',  label: 'QQQ',   category: 'index'  },
  { instId: 'DRAM-USDT-SWAP', symbol: 'DRAM', label: 'DRAM',  category: 'etf'     },
  { instId: 'SOXL-USDT-SWAP', symbol: 'SOXL', label: 'SOXL',  category: 'etf'     },
  { instId: 'CL-USDT-SWAP',   symbol: 'CL',   label: 'WTI',   category: 'commodity' },
  { instId: 'XAU-USDT-SWAP',  symbol: 'XAU',  label: 'GOLD',  category: 'commodity' },
];

const OKX_TICKERS_URL = 'https://www.okx.com/api/v5/market/tickers?instType=SWAP';
const POLL_INTERVAL_MS = 5_000;  // 5s — OKX allows 20 req/2s (600 req/min), so 12 req/min is trivial

/**
 * Format price with appropriate decimals based on magnitude.
 * BTC ~$60K → 0 decimals. ETH ~$3K → 2 decimals. Gold ~$4K → 1 decimal.
 */
function formatPrice(price) {
  if (price == null || !Number.isFinite(price)) return '—';
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 100)   return price.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (price >= 1)     return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function formatPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function pctColor(pct) {
  if (pct == null || !Number.isFinite(pct)) return 'var(--scanner-text3)';
  if (pct > 0) return 'var(--scanner-green)';
  if (pct < 0) return 'var(--scanner-red)';
  return 'var(--scanner-text3)';
}

async function fetchOkxTickers() {
  try {
    const res = await fetchWithTimeout(OKX_TICKERS_URL);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d?.data || !Array.isArray(d.data)) return null;
    // Build a map of instId → { last, open24h } for our 8 tickers
    const map = {};
    for (const t of d.data) {
      if (t.instId && t.last && t.open24h) {
        map[t.instId] = {
          last: parseFloat(t.last),
          open24h: parseFloat(t.open24h),
        };
      }
    }
    return map;
  } catch {
    return null;
  }
}

export default function ScrollingTicker() {
  const [prices, setPrices] = useState(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initial fetch immediately
    let timer;
    const poll = async () => {
      const data = await fetchOkxTickers();
      if (!mountedRef.current) return;
      if (data) {
        setPrices(data);
        setError(false);
      } else {
        setError(true);
      }
      // Schedule next poll
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Build the ticker items from the fetched data
  const items = TICKER_INST_IDS.map(({ instId, symbol, label }) => {
    const t = prices?.[instId];
    if (!t) {
      return { symbol, label, price: null, pct: null };
    }
    const pct = t.open24h > 0 ? ((t.last - t.open24h) / t.open24h) * 100 : null;
    return { symbol, label, price: t.last, pct };
  });

  // Duplicate the items array so the marquee loops seamlessly.
  // CSS animation translates from 0 to -50% of the total width,
  // and the second copy fills in as the first scrolls out.
  const marqueeItems = [...items, ...items];

  return (
    <div
      className="ticker-marquee-container"
      style={{
        background: 'var(--scanner-bg2)',
        borderBottom: '1px solid var(--scanner-border2)',
        overflow: 'hidden',
        position: 'relative',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        className="ticker-marquee-track"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          animation: 'ticker-scroll 60s linear infinite',
        }}
      >
        {marqueeItems.map((item, i) => (
          <span
            key={`${item.symbol}-${i}`}
            className="ticker-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 16px',
              borderRight: '1px solid var(--scanner-border)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '10px',
              lineHeight: '28px',
            }}
          >
            <span style={{ color: 'var(--scanner-text3)', fontWeight: 600, letterSpacing: '0.05em' }}>
              {item.label}
            </span>
            <span style={{ color: 'var(--scanner-text)', fontWeight: 600 }} className="tabular-nums">
              {formatPrice(item.price)}
            </span>
            <span style={{ color: pctColor(item.pct), fontWeight: 600 }} className="tabular-nums">
              {formatPct(item.pct)}
            </span>
          </span>
        ))}
      </div>

      {/* Error indicator — small dot in the corner if fetch failed */}
      {error && (
        <span
          title="Live price feed unavailable — showing last cached values"
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--scanner-red)',
            opacity: 0.6,
          }}
        />
      )}

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-marquee-container:hover .ticker-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-marquee-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
