import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseBreakout, BREAKOUT_STATES } from '../../src/lib/scanner/breakoutEngine.js';

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.UTC(2026, 8, 5, 12, 0, 0);

function candle(daysAgo, { high, close = high, vol = 100 } = {}) {
  const ts = BASE - daysAgo * DAY;
  return {
    ts,
    open: close,
    high,
    low: Math.min(close, high) * 0.98,
    close,
    vol,
  };
}

test('excludes the current candle when calculating the prior high', () => {
  const result = analyseBreakout([
    candle(10, { high: 100, close: 95 }),
    candle(3, { high: 110, close: 105 }),
    candle(0, { high: 125, close: 111, vol: 200 }),
  ], '1m');

  assert.equal(result.priorHigh, 110);
  assert.equal(result.state, BREAKOUT_STATES.BREAKING);
});

test('classifies approaching, breaking, and extended correctly', () => {
  const history = [
    candle(5, { high: 100, close: 96, vol: 100 }),
    candle(2, { high: 98, close: 97, vol: 100 }),
  ];

  const approaching = analyseBreakout([
    ...history,
    candle(0, { high: 100, close: 99, vol: 100 }),
  ], 'local');
  assert.equal(approaching.state, BREAKOUT_STATES.APPROACHING);

  const breaking = analyseBreakout([
    ...history,
    candle(0, { high: 102, close: 101, vol: 100 }),
  ], 'local');
  assert.equal(breaking.state, BREAKOUT_STATES.BREAKING);

  const extended = analyseBreakout([
    ...history,
    candle(0, { high: 105, close: 103, vol: 100 }),
  ], 'local');
  assert.equal(extended.state, BREAKOUT_STATES.EXTENDED);
});

test('ignores highs outside the selected lookback window', () => {
  const result = analyseBreakout([
    candle(45, { high: 200, close: 190 }),
    candle(20, { high: 120, close: 115 }),
    candle(5, { high: 125, close: 120 }),
    candle(0, { high: 126, close: 126 }),
  ], '1m');

  assert.equal(result.priorHigh, 125);
  assert.equal(result.state, BREAKOUT_STATES.BREAKING);
});

test('uses all available history when the asset is younger than the selected window', () => {
  const result = analyseBreakout([
    candle(120, { high: 150, close: 145 }),
    candle(60, { high: 140, close: 135 }),
    candle(0, { high: 151, close: 151 }),
  ], '5y');

  assert.equal(result.priorHigh, 150);
  assert.equal(result.barsExamined, 2);
  assert.equal(result.state, BREAKOUT_STATES.BREAKING);
});

test('calculates relative volume against prior candles', () => {
  const history = Array.from({ length: 20 }, (_, i) =>
    candle(20 - i, { high: 100 + i * 0.1, close: 99, vol: 100 })
  );

  const result = analyseBreakout([
    ...history,
    candle(0, { high: 102, close: 101, vol: 250 }),
  ], '1m');

  assert.equal(result.averageVolume, 100);
  assert.equal(result.volumeRatio, 2.5);
});
