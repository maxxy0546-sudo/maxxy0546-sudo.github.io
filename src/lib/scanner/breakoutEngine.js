const DAY_MS = 24 * 60 * 60 * 1000;

export const BREAKOUT_WINDOWS = [
  { id: 'local', label: 'LOCAL', days: 7 },
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '1y', label: '1Y', days: 365 },
  { id: '5y', label: '5Y', days: 365 * 5 },
];

export const BREAKOUT_STATES = {
  APPROACHING: 'approaching',
  BREAKING: 'breaking',
  EXTENDED: 'extended',
  BELOW: 'below',
};

function timestampToMs(value) {
  if (value == null) return null;

  if (typeof value === 'number') {
    // Seconds → milliseconds
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCandle(candle) {
  // Supports common exchange array format:
  // [timestamp, open, high, low, close, volume]
  if (Array.isArray(candle)) {
    return {
      time: timestampToMs(candle[0]),
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volume: Number(candle[5] || 0),
    };
  }

  // Also supports object-based OHLC data
  return {
    time: timestampToMs(
      candle.time ??
      candle.timestamp ??
      candle.ts ??
      candle.date
    ),
    open: Number(candle.open ?? candle.o),
    high: Number(candle.high ?? candle.h),
    low: Number(candle.low ?? candle.l),
    close: Number(candle.close ?? candle.c),
    volume: Number(candle.volume ?? candle.v ?? 0),
  };
}

function average(values) {
  const valid = values.filter(
    value => Number.isFinite(value) && value > 0
  );

  if (!valid.length) return null;

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function analyseBreakout(
  candles,
  windowId = '1m',
  {
    approachingPct = 2,
    breakingPct = 2,
  } = {}
) {
  if (!Array.isArray(candles) || candles.length < 2) {
    return null;
  }

  const normalized = candles
    .map(normalizeCandle)
    .filter(
      candle =>
        candle.time &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.close)
    )
    .sort((a, b) => a.time - b.time);

  if (normalized.length < 2) {
    return null;
  }

  // Latest candle is deliberately excluded from prior-high calculation.
  const current = normalized[normalized.length - 1];
  const history = normalized.slice(0, -1);

  const selectedWindow =
    BREAKOUT_WINDOWS.find(window => window.id === windowId) ??
    BREAKOUT_WINDOWS[1];

  const cutoff =
    current.time - selectedWindow.days * DAY_MS;

  // If a coin is younger than the requested window,
  // all available history is naturally used.
  const lookback = history.filter(
    candle => candle.time >= cutoff
  );

  if (!lookback.length) {
    return null;
  }

  let priorHighCandle = lookback[0];

  for (const candle of lookback) {
    if (candle.high > priorHighCandle.high) {
      priorHighCandle = candle;
    }
  }

  const priorHigh = priorHighCandle.high;

  if (!Number.isFinite(priorHigh) || priorHigh <= 0) {
    return null;
  }

  const distancePct =
    ((current.close - priorHigh) / priorHigh) * 100;

  let state = BREAKOUT_STATES.BELOW;

  if (distancePct >= -approachingPct && distancePct < 0) {
    state = BREAKOUT_STATES.APPROACHING;
  } else if (
    distancePct >= 0 &&
    distancePct <= breakingPct
  ) {
    state = BREAKOUT_STATES.BREAKING;
  } else if (distancePct > breakingPct) {
    state = BREAKOUT_STATES.EXTENDED;
  }

  // Relative volume versus the previous 20 candles.
  const recentVolumes = history
    .slice(-20)
    .map(candle => candle.volume);

  const averageVolume = average(recentVolumes);

  const volumeRatio =
    averageVolume && current.volume
      ? current.volume / averageVolume
      : null;

  return {
    window: selectedWindow.id,
    windowLabel: selectedWindow.label,

    price: current.close,

    priorHigh,
    priorHighTime: priorHighCandle.time,
    priorHighDate: new Date(
      priorHighCandle.time
    ).toISOString().slice(0, 10),

    distancePct,
    state,

    volume: current.volume,
    averageVolume,
    volumeRatio,

    barsExamined: lookback.length,

    isApproaching:
      state === BREAKOUT_STATES.APPROACHING,

    isBreaking:
      state === BREAKOUT_STATES.BREAKING,

    isExtended:
      state === BREAKOUT_STATES.EXTENDED,
  };
}
