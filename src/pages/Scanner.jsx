import React, { useState, useRef, useCallback, useEffect } from 'react';
import ScannerHeader from '@/components/scanner/ScannerHeader';
import ScannerControls from '@/components/scanner/ScannerControls';
import ProgressBar from '@/components/scanner/ProgressBar';
import ResultsTable from '@/components/scanner/ResultsTable';
import BreakoutResultsTable from '@/components/scanner/BreakoutResultsTable';
import StatusBar from '@/components/scanner/StatusBar';
import MassiveApiKeyInput from '@/components/scanner/MassiveApiKeyInput';
import TradingViewChart from '@/components/scanner/TradingViewChart';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { runScan } from '@/lib/scanner/scanEngine';
import { runTradFiScan } from '@/lib/scanner/tradfiScanEngine';
import { runBreakoutScan } from '@/lib/scanner/breakoutScanEngine';

const STORAGE_KEY = 'trendscan_scanner_settings';

const DEFAULT_SETTINGS = {
  mode: 'crypto',        // 'crypto' | 'tradfi' — scanner mode toggle
  fastType: 'ema',
  emaFast: 21,
  vwapFastDays: 3,
  midType: 'ema',
  emaMid: 100,
  vwapMidDays: 14,
  slowType: 'vwap',
  emaSlow: 200,
  vwapDays: 30,
  exchange: 'okx_perps',
  timeframe: '4H',
  concurrency: 10,
  // Filters
  minVolume: 0,        // 0 = no filter, otherwise USD value (e.g. 1000000 = $1M min)
  minMarketCap: 0,      // 0 = no filter, otherwise USD value (e.g. 10000000 = $10M min)

  // NEW — explicit enable/disable per filter
  priceAboveSlowEnabled: true,   // gates: price > slow
  fastAboveMidEnabled: true,     // gates: fast > mid
  minVolumeEnabled: true,        // gates: volume24h >= minVolume (also still needs minVolume > 0)
  minMarketCapEnabled: true,     // gates: marketCap >= minMarketCap (also still needs minMarketCap > 0)

  // NEW — RSI range filter
  rsiEnabled: false,             // default OFF — new filter, don't change existing scan behavior for anyone
  rsiPeriod: 14,
  rsiTimeframe: '1D',            // separate timeframe for RSI (default daily — most common RSI usage)
  rsiMin: 0,
  rsiMax: 100,

  // Phase 2 — chain + sector filters (default: no filter)
  chainFilter: 'All',            // 'All' | 'Native' | 'Ethereum' | 'Solana' | 'BNB' | etc.
  sectorFilter: 'All',           // 'All' | 'defi' | 'ai-agents' | 'memes' | etc. (CMC tag slugs)

  // Phase 1c — max supply filter (0 = no filter)
  maxSupplyFilter: 0,            // minimum max supply (filters out inflationary coins with null maxSupply)
};

const BREAKOUT_WINDOWS = [
  { id: 'local', label: 'LOCAL' },
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '1y', label: '1Y' },
  { id: '5y', label: '5Y' },
];

const BREAKOUT_STATES = [
  { id: 'approaching', label: 'Approaching' },
  { id: 'breaking', label: 'Breaking' },
  { id: 'extended', label: 'Extended' },
  { id: 'all', label: 'All' },
];

export default function Scanner() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, matched: 0, message: '—' });
  const [scannerView, setScannerView] = useState('scanner');
  const [breakoutWindow, setBreakoutWindow] = useState('1m');
  const [breakoutState, setBreakoutState] = useState('breaking');
  const [breakoutResults, setBreakoutResults] = useState([]);
  const [breakoutMeta, setBreakoutMeta] = useState({ updatedAt: null, duration: null });

  // Results are stored per-mode so switching Crypto↔TradFi preserves each mode's results
  const [cryptoResults, setCryptoResults] = useState(() => {
    try {
      const saved = sessionStorage.getItem('trendscan_scanner_results_crypto');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [tradfiResults, setTradfiResults] = useState(() => {
    try {
      const saved = sessionStorage.getItem('trendscan_scanner_results_tradfi');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [cryptoMeta, setCryptoMeta] = useState(() => {
    try {
      const saved = sessionStorage.getItem('trendscan_scanner_meta_crypto');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { updatedAt: null, duration: null };
  });
  const [tradfiMeta, setTradfiMeta] = useState(() => {
    try {
      const saved = sessionStorage.getItem('trendscan_scanner_meta_tradfi');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { updatedAt: null, duration: null };
  });
  const [error, setError] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const throttleRef = useRef(null);

  // Active results/meta are derived from the current mode
  const isTradFiMode = settings.mode === 'tradfi';
  const results = scannerView === 'breakout'
    ? breakoutResults
    : (isTradFiMode ? tradfiResults : cryptoResults);
  const scanMeta = scannerView === 'breakout'
    ? breakoutMeta
    : (isTradFiMode ? tradfiMeta : cryptoMeta);

  // Refs to hold the current result/meta setters so handleProgress (which has []
  // deps for stable identity) can always write to the correct state.
  const setResultsRef = useRef(setCryptoResults);
  const setScanMetaRef = useRef(setCryptoMeta);
  useEffect(() => {
    if (scannerView === 'breakout') {
      setResultsRef.current = setBreakoutResults;
      setScanMetaRef.current = setBreakoutMeta;
    } else if (isTradFiMode) {
      setResultsRef.current = setTradfiResults;
      setScanMetaRef.current = setTradfiMeta;
    } else {
      setResultsRef.current = setCryptoResults;
      setScanMetaRef.current = setCryptoMeta;
    }
  }, [scannerView, isTradFiMode]);

  // Persist results to sessionStorage whenever they change
  useEffect(() => {
    try {
      if (cryptoResults.length > 0) {
        sessionStorage.setItem('trendscan_scanner_results_crypto', JSON.stringify(cryptoResults));
      } else {
        sessionStorage.removeItem('trendscan_scanner_results_crypto');
      }
    } catch {}
  }, [cryptoResults]);

  useEffect(() => {
    try {
      if (tradfiResults.length > 0) {
        sessionStorage.setItem('trendscan_scanner_results_tradfi', JSON.stringify(tradfiResults));
      } else {
        sessionStorage.removeItem('trendscan_scanner_results_tradfi');
      }
    } catch {}
  }, [tradfiResults]);

  // Persist scan metadata to sessionStorage
  useEffect(() => {
    try {
      if (cryptoMeta.updatedAt) {
        sessionStorage.setItem('trendscan_scanner_meta_crypto', JSON.stringify(cryptoMeta));
      }
    } catch {}
  }, [cryptoMeta]);

  useEffect(() => {
    try {
      if (tradfiMeta.updatedAt) {
        sessionStorage.setItem('trendscan_scanner_meta_tradfi', JSON.stringify(tradfiMeta));
      }
    } catch {}
  }, [tradfiMeta]);

  // Massive API key check removed — 'auto' default uses free sources via the resolver.
  // Modal can still be triggered manually from ScannerControls if user wants Massive/Polygon.

  const handleProgress = useCallback((p) => {
    setStatus(p.phase);
    setProgress({
      done: p.done || 0,
      total: p.total || 0,
      matched: p.matched || 0,
      message: p.message || `${p.done || 0}/${p.total || '—'} scanned`
    });

    // Handle completion FIRST — must not be skipped by the throttle below.
    if (p.phase === 'complete') {
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      setResultsRef.current(p.results);
      setScanMetaRef.current({ updatedAt: p.updatedAt, duration: p.duration });
      return;
    }

    if (p.results) {
      if (throttleRef.current) return;
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
      }, 200);
      setResultsRef.current([...p.results]);
    }
  }, []);

  const startScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    setError(null);
    setResultsRef.current([]);  // clear only the active view's results
    setProgress({ done: 0, total: 0, matched: 0, message: '—' });

    try {
      if (scannerView === 'breakout') {
        await runBreakoutScan(
          {
            ...settings,
            breakoutWindow,
            breakoutState,
          },
          handleProgress
        );
      } else {
        const scanFn = settings.mode === 'tradfi' ? runTradFiScan : runScan;
        await scanFn(settings, handleProgress);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
      setProgress(prev => ({ ...prev, message: err.message }));
    } finally {
      setIsScanning(false);
    }
  }, [settings, scannerView, breakoutWindow, breakoutState, isScanning, handleProgress]);

  // Mode toggle: swap between crypto and tradfi. Also swaps the exchange/source
  // to a sensible default for the new mode so the user doesn't get stuck with
  // an invalid combination (e.g. 'hyperliquid' exchange in tradfi mode).
  // Results are stored per-mode so switching preserves each mode's results.
  // Switching is blocked while a scan is in progress to prevent freeze.
  const handleModeChange = useCallback((newMode) => {
    if (isScanning || scannerView === 'breakout') return;
    setSettings(prev => {
      if (prev.mode === newMode) return prev;
      const newExchange = newMode === 'tradfi' ? 'auto' : 'okx_perps';
      return { ...prev, mode: newMode, exchange: newExchange };
    });
    setStatus('idle');
    setProgress({ done: 0, total: 0, matched: 0, message: '—' });
    setSelectedRow(null);
  }, [isScanning, scannerView]);

  const handleScannerViewChange = useCallback((view) => {
    if (isScanning || view === scannerView) return;
    setScannerView(view);
    setStatus('idle');
    setProgress({ done: 0, total: 0, matched: 0, message: '—' });
    setError(null);
    setSelectedRow(null);
  }, [isScanning, scannerView]);

  return (
    <div
      className="min-h-screen pb-16 font-mono"
      style={{
        background: 'var(--scanner-bg)',
        color: 'var(--scanner-text)'
      }}
    >
      <ScannerHeader settings={settings} scanMeta={scanMeta} onModeChange={handleModeChange} />

      <div
        className="px-5 md:px-8 py-3 flex flex-wrap items-center gap-2"
        style={{
          background: 'var(--scanner-bg1)',
          borderBottom: '1px solid var(--scanner-border2)'
        }}
      >
        <div className="flex items-center overflow-hidden" style={{ border: '1px solid var(--scanner-border2)' }}>
          {[
            ['scanner', 'SCREENER'],
            ['breakout', 'BREAKOUTS'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => handleScannerViewChange(id)}
              disabled={isScanning}
              className="font-mono text-[10px] font-bold tracking-[0.12em] px-3 py-2"
              style={{
                border: 'none',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                background: scannerView === id ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: scannerView === id ? 'var(--scanner-accent)' : 'var(--scanner-text3)'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {scannerView === 'breakout' && (
          <>
            <div className="flex items-center overflow-hidden" style={{ border: '1px solid var(--scanner-border2)' }}>
              {BREAKOUT_WINDOWS.map(window => (
                <button
                  key={window.id}
                  onClick={() => setBreakoutWindow(window.id)}
                  disabled={isScanning}
                  className="font-mono text-[9px] font-bold tracking-wide px-2.5 py-2"
                  style={{
                    border: 'none',
                    cursor: isScanning ? 'not-allowed' : 'pointer',
                    background: breakoutWindow === window.id ? 'rgba(34,211,238,0.12)' : 'transparent',
                    color: breakoutWindow === window.id ? 'var(--scanner-cyan)' : 'var(--scanner-text3)'
                  }}
                >
                  {window.label}
                </button>
              ))}
            </div>

            <div className="flex items-center overflow-hidden" style={{ border: '1px solid var(--scanner-border2)' }}>
              {BREAKOUT_STATES.map(item => (
                <button
                  key={item.id}
                  onClick={() => setBreakoutState(item.id)}
                  disabled={isScanning}
                  className="font-mono text-[9px] font-bold tracking-wide px-2.5 py-2"
                  style={{
                    border: 'none',
                    cursor: isScanning ? 'not-allowed' : 'pointer',
                    background: breakoutState === item.id ? 'rgba(217,70,239,0.12)' : 'transparent',
                    color: breakoutState === item.id ? 'var(--scanner-magenta)' : 'var(--scanner-text3)'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={startScan}
              disabled={isScanning}
              className="font-mono text-[10px] font-bold tracking-[0.12em] px-4 py-2"
              style={{
                border: '1px solid var(--scanner-accent)',
                background: 'rgba(245,158,11,0.12)',
                color: 'var(--scanner-accent)',
                cursor: isScanning ? 'not-allowed' : 'pointer',
                opacity: isScanning ? 0.6 : 1,
              }}
            >
              {isScanning ? 'SCANNING…' : 'RUN BREAKOUT SCAN'}
            </button>
          </>
        )}
      </div>

      {scannerView === 'scanner' && (
        <ScannerControls
          settings={settings}
          onSettingsChange={setSettings}
          isScanning={isScanning}
          onScan={startScan}
        />
      )}

      <ProgressBar progress={progress} status={status} />

      {error && (
        <div className="mx-5 md:mx-8 mt-3 px-3.5 py-2.5 text-[11px] tracking-wide" style={{
          background: 'rgba(255,68,68,0.05)',
          border: '1px solid rgba(255,68,68,0.2)',
          color: 'var(--scanner-red)'
        }}>
          ⚠ &nbsp;{error}
        </div>
      )}

      {scannerView === 'breakout' ? (
        <BreakoutResultsTable
          results={breakoutResults}
          isScanning={isScanning}
          hasScanned={status !== 'idle'}
        />
      ) : (
        <ResultsTable
          results={results}
          settings={settings}
          isScanning={isScanning}
          hasScanned={status !== 'idle'}
          onSelectRow={setSelectedRow}
        />
      )}

      {scannerView === 'scanner' && <StatusBar settings={settings} />}

      {showApiKeyModal && (
        <MassiveApiKeyInput onClose={() => setShowApiKeyModal(false)} />
      )}

      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl p-0 flex flex-col"
          style={{ background: 'var(--scanner-bg)', border: 'none', overflow: 'hidden', maxWidth: '672px' }}
        >
          <SheetHeader className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--scanner-border)' }}>
            <SheetTitle style={{ color: 'var(--scanner-text)' }}>
              {selectedRow?.symbol} · {settings.timeframe}
            </SheetTitle>
          </SheetHeader>
          <div className="tradingview-chart-container flex-1" style={{ minHeight: '300px', position: 'relative' }}>
            {selectedRow && (
              <TradingViewChart
                symbol={selectedRow.symbol}
                exchange={settings.exchange}
                timeframe={settings.timeframe}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}// force rebuild
