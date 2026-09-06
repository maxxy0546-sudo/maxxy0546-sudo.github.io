import React from 'react';

function pct(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function money(value) {
  if (!Number.isFinite(value)) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export default function BreakoutResultsTable({
  results = [],
  isScanning,
  hasScanned,
}) {
  if (!results.length) {
    return (
      <div className="mx-5 md:mx-8 mt-6 text-sm opacity-60">
        {isScanning
          ? 'Scanning for breakouts…'
          : hasScanned
            ? 'No breakout matches found.'
            : 'Run the breakout scan to see matches.'}
      </div>
    );
  }

  return (
    <div className="mx-5 md:mx-8 mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-60">
            <th className="py-3 pr-4">Coin</th>
            <th className="py-3 pr-4">Price</th>
            <th className="py-3 pr-4">Prior High</th>
            <th className="py-3 pr-4">Distance</th>
            <th className="py-3 pr-4">Volume</th>
            <th className="py-3 pr-4">High Date</th>
            <th className="py-3">State</th>
          </tr>
        </thead>

        <tbody>
          {results.map((row, index) => (
            <tr
              key={`${row.symbol}-${index}`}
              className="border-t"
              style={{
                borderColor: 'var(--scanner-border)',
              }}
            >
              <td className="py-3 pr-4 font-semibold">
                {row.symbol}
              </td>

              <td className="py-3 pr-4">
                {money(row.price)}
              </td>

              <td className="py-3 pr-4">
                {money(row.priorHigh)}
              </td>

              <td className="py-3 pr-4">
                {pct(row.distancePct)}
              </td>

              <td className="py-3 pr-4">
                {Number.isFinite(row.volumeRatio)
                  ? `${row.volumeRatio.toFixed(1)}×`
                  : '—'}
              </td>

              <td className="py-3 pr-4">
                {row.priorHighDate ?? '—'}
              </td>

              <td className="py-3 uppercase">
                {row.state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
