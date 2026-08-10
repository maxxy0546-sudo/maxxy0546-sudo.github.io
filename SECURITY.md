# Security Policy

## Reported vulnerabilities

### Polygon.io API key embedded in client bundle (audit-1, audit-2, audit-3)

**Severity:** Medium (key is rate-limited free tier, abuse potential is limited)

**Status:** Resolved (2026-07-16). Operator regenerated the key on the
Polygon dashboard and updated the `VITE_MASSIVE_API_KEY` GitHub Actions
secret. The old key (fingerprint: `…l5ll`) has been rotated out of the
deployed bundle. If the old key was not revoked on the Polygon dashboard,
do so now — it is no longer used by the app but could still be abused
if active.

**Verification (run after deploy completes):**
```bash
# Extract the old key fingerprint (last 4 chars) and check the live bundle
curl -s https://trend-scan.github.io/ | grep -oE 'assets/index-[^"]+\.js' | head -1 \
  | xargs -I{} curl -s https://trend-scan.github.io/{} \
  | grep -c 'l5ll'
# Should print 0
```

**What was exposed:** The Polygon.io / Massive API key was baked into the
deployed JS bundle by Vite at build time (via the `VITE_MASSIVE_API_KEY`
GitHub Actions secret). Anyone who read the bundle source could extract
and reuse the key.

**Mitigations in place:**
- The key is the **free tier** (5 req/min, no paid entitlements)
- The resolver falls back through 6 other free sources (Hyperliquid, OKX,
  Bybit, Binance, Yahoo proxy, CoinGecko) before hitting Polygon, so most
  users never trigger a Polygon call
- Runtime override is supported: users can paste their own key via
  `localStorage.setItem('MASSIVE_API_KEY', '<their-key>')` in the browser
  console, which is the ONLY way Polygon is now invoked

**Completed hardening (2026-08-11):** The `VITE_MASSIVE_API_KEY` line was
removed from `.github/workflows/deploy.yml` (verified by `grep VITE_MASSIVE
.github/workflows/*.yml` → no matches). The resolver no longer ships any
Polygon key in the bundle — `fetchMassiveCandles` in
`src/lib/scanner/exchanges.js` reads from `localStorage` only, aligning with
the security policy in `src/lib/scanner/sources/massive.js` (which has always
been localStorage-only). The free tier key that was previously bundled has
been rotated out and is no longer used by the app.

---

## Reporting a vulnerability

If you discover a security issue, please open a private security advisory:
- Repo → Security → Advisories → "Report a vulnerability"

Or email the maintainer directly. Please do not open a public issue for
security-sensitive reports.
