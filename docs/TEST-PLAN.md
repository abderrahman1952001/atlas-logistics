# Atlas integration verification

The integration suite drives the compiled NestJS application over HTTP against a real PostgreSQL database. It does not mock persistence or replace PostgreSQL with SQLite. Each actor has a separate cookie jar and CSRF token, modeling distinct browser sessions with fixed company memberships.

Run `npm test` after starting PostgreSQL, applying migrations, running the explicit synthetic seed, and starting the API. Set `BASE_URL`, `APP_ORIGIN` and `DEMO_PASSWORD` when they differ from the documented local defaults. The suite creates uniquely labelled synthetic requests; use an isolated test database. It does not delete business records.

The cases verify authentication failures, confidential session fields, HttpOnly/SameSite cookie flags, CSRF and Origin protection, DTO allowlists, request ownership, private competing quotations, pending/suspended company restrictions, administrator boundaries, a race between two quote acceptances, optimistic concurrency, booking state transitions, review ownership and uniqueness, cancellation rules, notification ownership, audit visibility and logout revocation.

The booking race asserts both API outcomes and persisted state: exactly one acceptance succeeds, one conflicts, one booking exists, one quote is accepted and the other rejected. Workflow tests proceed through confirmed, in transit, delivered and customer-confirmed completion before allowing a review.

These are application-level regression tests, not a penetration test, external audit, production load test or proof of long-term availability. Password reset, outbound mail and billing are outside the current demonstration. Docker build/start and database persistence/restart checks are recorded separately by the release owner. A passing workflow file is not itself a passing GitHub Actions run: link a completed actual run before claiming CI verification.

## Recorded local verification

On 29 October 2026, all 18 integration tests passed against the compiled NestJS API at `127.0.0.1:3000` and actual PostgreSQL, with `APP_ORIGIN=http://127.0.0.1:5174`. The suite completed in approximately 5.9 seconds with zero failures or skipped cases. This result covers the running local services; the container/CI release checks and restart result must be reported separately.

After the API process was rebuilt and restarted, `tests/persistence.mjs` passed: the previously created request, accepted quotation, booking and audit evidence remained in PostgreSQL. An additional nineteenth integration case subsequently passed in a focused run, verifying safe HTTP 400 for malformed JSON and HTTP 413 for oversized bodies, with no stack trace/HTML exposure and no session corruption. A twentieth case also passed in a focused run: changing client-supplied X-Forwarded-For values does not evade the per-account login throttle (twelve invalid attempts return401, the thirteenth returns429). The complete twenty-case suite is intended for the container release run.
