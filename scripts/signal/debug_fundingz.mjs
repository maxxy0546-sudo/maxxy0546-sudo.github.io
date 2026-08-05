// Debug: trace fundingZScore computation on BTC data at multiple timestamps

import fs from 'node:fs';
import path from 'node:path';
import { fundingZScore } from '/home/z/my-project/trendscan-migrate/trend-scan.github.io/src/lib/signal/compute.js';

const DATA_DIR = '/home/z/my-project/trendscan-migrate/trend-scan.github.io/data/historical';

const funding = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'BTC', 'funding.json'), 'utf8'));
const klines = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'BTC', 'klines_1d.json'), 'utf8'));

console.log('=== Raw funding data sample ===');
console.log('First 3 entries:');
for (const e of funding.slice(0, 3)) console.log(' ', JSON.stringify(e));
console.log('Has .ts field?', funding[0].ts !== undefined);
console.log('Has .t field?', funding[0].t !== undefined);
console.log('');

console.log('=== Testing fundingZScore at various as-of timestamps ===');
// Test at multiple points: 1/4/2022, 7/1/2022, 1/1/2023, 7/1/2023, 1/1/2024, 7/1/2024, 1/1/2025, 7/1/2025
const testDates = ['2022-04-01', '2022-07-01', '2023-01-01', '2023-07-01', '2024-01-01', '2024-07-01', '2025-01-01', '2025-07-01'];
for (const date of testDates) {
  const ts = Date.parse(date);
  // Test 1: pass funding as-is (with .t field, no .ts)
  const z1 = fundingZScore(funding, ts, 90);
  // Test 2: pass funding with .ts = .t (workaround)
  const fundingWithTs = funding.map(f => ({ ...f, ts: f.t }));
  const z2 = fundingZScore(fundingWithTs, ts, 90);
  // Check how many entries pass the filter
  const filteredOriginal = funding.filter(f => f.ts <= ts);
  const filteredWithTs = fundingWithTs.filter(f => f.ts <= ts);
  console.log(`  ${date}: original funding → z=${z1} (filtered n=${filteredOriginal.length})  | with .ts → z=${z2.toFixed(4)} (filtered n=${filteredWithTs.length})`);
}

console.log('');
console.log('=== Confirm: production snapshot shows non-zero fundingZ ===');
console.log('Live BTC fundingZ from snapshot: -0.25 (per audit)');
console.log('This means production has the .ts field somewhere — likely build_snapshot.js');
console.log('normalizes the funding data before passing to computeSignal.');
console.log('');

// Check build_snapshot.js to see how funding data is shaped
console.log('=== Check how build_snapshot.js shapes funding data ===');
const bs = fs.readFileSync('/home/z/my-project/trendscan-migrate/trend-scan.github.io/scripts/build_snapshot.js', 'utf8');
// Find funding-related code
const lines = bs.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/funding/i) && !lines[i].trim().startsWith('//')) {
    console.log(`  L${i+1}: ${lines[i].trim().slice(0, 100)}`);
  }
}
