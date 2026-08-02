import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * SpaAwareRedirect — handles GitHub Pages SPA fallback URLs.
 *
 * When a user visits a deep link like https://trend-scan.github.io/board
 * directly, GitHub Pages returns the static 404.html (because there's no
 * server-side route). That 404.html runs a script that redirects to
 * `/?/board` (with the path encoded in the query string).
 *
 * Without this component, React Router sees the URL as `/` (ignoring the
 * query string) and renders the Scanner (home) page — losing the user's
 * intended destination.
 *
 * This component detects the `?/path` query pattern and uses
 * `navigate(..., { replace: true })` to restore the original route.
 *
 * The `~and~` decoding handles the case where the original URL had query
 * parameters (the 404.html script encodes `&` as `~and~` to avoid
 * ambiguity).
 *
 * SECURITY: The captured path is validated against a strict whitelist of
 * known app routes. Any path containing backslashes, protocol-relative
 * prefixes (//), or not in the whitelist is rejected and the user is
 * redirected to the home page. This prevents open-redirect attacks that
 * exploit react-router 6.x's incomplete URL sanitization (CVE-2025-68470
 * bypass, GHSA-wrjc-x8rr-h8h6). The whitelist also closes our specific
 * attack surface even without upgrading to react-router 7.17+.
 *
 * Mount this ONCE inside <Router> in App.jsx.
 */

// Strict whitelist of valid app routes. Must match the <Route> definitions
// in App.jsx. Any SPA fallback path not in this list is rejected.
const VALID_ROUTES = new Set(['', 'board', 'macro', 'signal']);

export default function SpaAwareRedirect() {
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    // Match the SPA fallback pattern: starts with ?/ followed by a path
    // segment. Examples:
    //   ?/board         → /board
    //   ?/macro         → /macro
    //   ?/board&foo=bar → /board?foo=bar
    const m = search.match(/^\?\/([^&]+)/);
    if (!m) return;

    const pathSegment = m[1];

    // ── Security validation (defense-in-depth against open redirect) ──────
    // Reject any path that:
    // 1. Contains a backslash — react-router 6.x doesn't sanitize these,
    //    and browsers may interpret /\evil.com as //evil.com (open redirect)
    // 2. Starts with / or \ — would create // or /\ prefix (protocol-relative)
    // 3. Contains :// — explicit protocol injection (e.g., https://evil.com)
    // 4. Is not in the VALID_ROUTES whitelist
    if (
      pathSegment.includes('\\') ||
      pathSegment.startsWith('/') ||
      pathSegment.includes('://') ||
      !VALID_ROUTES.has(pathSegment)
    ) {
      // Suspicious path — redirect to home page instead of the attacker-controlled URL
      console.warn('[SpaAwareRedirect] Rejected suspicious SPA fallback path:', pathSegment);
      navigate('/', { replace: true });
      return;
    }

    const path = '/' + pathSegment;
    // Everything after the matched path segment, with ~and~ decoded back to &
    const remaining = search.slice(m[0].length);
    const queryString = remaining ? remaining.replace(/~and~/g, '&') : '';

    navigate(path + queryString, { replace: true });
  }, [search, navigate]);

  return null;
}
