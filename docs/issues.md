# Issues Audit

Date: 2026-03-01

## Critical

1. Unauthenticated remote control surface exposed to LAN and cross-origin pages.
   - `server/server.js:981` sets `Access-Control-Allow-Origin: *` for all `/api/*`.
   - `server/server.js:1210` binds server on all interfaces (`0.0.0.0`).
   - `script_test/README.md:17` explicitly encourages LAN access.
   - Impact: any reachable host/page can read/write state and hit agent/runtime APIs.

2. Systemic stored injection risk from unsafe `innerHTML` usage.
   - Examples:
   - `public/js/links.js:42,44,46,50`
   - `public/js/todo.js:290,292,296`
   - `public/js/projects.js:622,639,652`
   - `public/js/journal.js:183,185`
   - `public/js/app.js:260,268`
   - Impact: user-provided data is rendered into HTML without escaping/sanitization.

3. `file://` mode bypasses server-side security headers/CSP.
   - `README.md:35` states filesystem mode is supported.
   - Impact: protections in `server/lib/security-headers.js` do not apply when served from file origin.

4. Malformed URL can crash static request handling.
   - `server/server.js:959` uses `decodeURIComponent` without guard.
   - Impact: invalid percent-encoding can throw `URIError` and disrupt requests.

## High

5. Documented server sync mode is currently nonfunctional.
   - `public/js/storage.js:23-24` hardcodes `canUseServerStateSync()` to `false`.
   - `README.md:15` claims optional server mode via `/api/state`.
   - Impact: product behavior does not match documentation.

6. Expensive agent runtime endpoints are unauthenticated and unrestricted.
   - `server/server.js:1078` (`/api/agent/runtime/task`)
   - `server/server.js:1110` (`/api/agent/runtime/command`)
   - Task execution/queue paths: `server/server.js:683`, `server/server.js:878`
   - Impact: abuse can force repeated model work and resource drain.

7. Synchronous filesystem I/O across request paths.
   - Examples:
   - `server/server.js:98,108,176,215,225,297,967`
   - Impact: event-loop blocking under concurrent usage.

## Medium

8. State application clears unrelated storage keys on shared origin.
   - `public/js/storage.js:174` collects all keys.
   - `public/js/storage.js:255` removes all keys before applying state.
   - Impact: collateral data loss for same-origin apps.

9. Local quality gate and CI quality gate diverge.
   - Local `verify` includes e2e: `package.json:25`.
   - CI does not run e2e: `.github/workflows/ci.yml:25-38`.
   - Impact: UI regressions can pass CI.

10. Test coverage is shallow for risk profile.
   - Unit scope is minimal: `tests/state-contract.test.js`, `tests/version-sync.test.js`.
   - E2E scope is mostly smoke/header checks: `e2e/smoke.spec.mjs`.
   - Impact: high-risk paths (security/auth/robustness) are not exercised.

## Notes

- Lint and current tests pass, but they do not validate the highest-risk failure modes listed above.
