# Atlas Logistics

A multi-company transport workflow built with **NestJS 12, PostgreSQL 17, React 19 and TypeScript**, packaged with Docker Compose. Customers request transport and compare quotes; verified providers quote and deliver; administrators review companies and inspect the audit trail.

[![Atlas verification](https://github.com/abderrahman1952001/atlas-logistics/actions/workflows/ci.yml/badge.svg)](https://github.com/abderrahman1952001/atlas-logistics/actions/workflows/ci.yml)

[Current fast live demo](https://cadrienstudio.com/operations) · [Atlas case study](https://cadrienstudio.com/work/atlas/) · [Automated test runs](https://github.com/abderrahman1952001/atlas-logistics/actions/workflows/ci.yml)

This is the separately runnable NestJS implementation. The existing fast demonstration stays online. All sample companies and shipments are synthetic; no payment or transport service is performed.

## Run the complete application

Requires Docker Engine with Docker Compose v2, an internet connection for the initial image download, and a free local port 8080. No cloud account, credit card or paid API is required.

```sh
git clone https://github.com/abderrahman1952001/atlas-logistics.git
cd atlas-logistics
docker compose up --build -d
```

Open **http://localhost:8080** after the API health check passes. Initial startup installs locked packages, builds both applications, waits for PostgreSQL, applies the schema migration and seeds the local demonstration. Subsequent starts retain data in the `postgres_data` volume.

Local demo password: **`AtlasDemo!2026`**. These are deliberately public synthetic credentials, not production accounts.

| Account                    | Role                                    |
| -------------------------- | --------------------------------------- |
| `customer@atlas.example`   | Customer                                |
| `provider@atlas.example`   | Verified transport provider             |
| `competitor@atlas.example` | Competing verified provider             |
| `admin@atlas.example`      | Administrator                           |
| `pending@atlas.example`    | Provider awaiting verification          |
| `second@atlas.example`     | Separate customer for isolation testing |

Copy `.env.example` to `.env` to override local settings. Keep the same hostname for the browser and `APP_ORIGIN`; `localhost` and `127.0.0.1` are different origins. The default published port binds to loopback only.

```sh
docker compose logs -f api
docker compose stop                 # keep records
docker compose down                # remove containers; keep records
# Delete only your disposable sample data when you want a fresh demonstration:
docker compose down -v
```

## Walk through the workflow

1. Sign in as the customer and create a request with a route, cargo, weight and pickup date.
2. Sign out and sign in as each provider to submit distinct quotes.
3. As the customer, compare and accept a quote. Exactly one booking can be created for a request, including under concurrent acceptance attempts.
4. The selected provider moves the booking to **In transit**, then **Delivered**. The customer confirms **Completed** and can leave one review.
5. As administrator, inspect companies and activity. Suspend a provider to test authorization. The application checks permissions on the server for every action.

## Verify the implementation

With the Compose stack running, Node.js 24.19 or later on the 24.x line is sufficient to run the HTTP tests—no test dependencies need installing on your computer:

```sh
BASE_URL=http://localhost:8080 npm test
docker compose restart db api
until curl --fail --silent http://localhost:8080/health/ready; do sleep 2; done
BASE_URL=http://localhost:8080 node tests/persistence.mjs
```

The tests use the actual HTTP server and PostgreSQL. They exercise authentication, CSRF/origin checks, company isolation, private competitor quotes, suspended providers, simultaneous quote acceptance, optimistic version checks, legal booking transitions, cancellation, single reviews, scoped activity/notifications and session invalidation. The restart check reads a unique record created by the integration run after PostgreSQL and the API restart. See [test plan](docs/TEST-PLAN.md).

GitHub Actions builds and runs the actual Compose stack on a standard public-repository Ubuntu runner. It uploads no artifacts and uses no paid services. A workflow file alone is not a passing test result: inspect the linked run and commit.

## Architecture

```mermaid
flowchart LR
    Browser[React browser application] --> Web[Nginx same-origin gateway]
    Web --> API[NestJS controllers and policy checks]
    API --> DB[(PostgreSQL)]
    Setup[Migration and opt-in sample seed] --> DB
```

- The API owns authorization and state transitions. Hidden buttons are a convenience, not a permission boundary.
- Sessions are opaque tokens in HttpOnly cookies; their hashes are stored in PostgreSQL. Passwords are hashed with scrypt. Mutations require a session-bound CSRF token and an allowed origin.
- Parameterized SQL, foreign keys, constraints and row locks protect domain invariants. Accepting a quote, creating the booking, changing related statuses and recording activity form one database transaction.
- Money uses integer DZD amounts. Updates carry a version to detect stale data instead of silently overwriting changes.
- Containers run without root privileges. Only the web gateway is published to the host; database and API stay on the private Compose network.
- Liveness is at `/health/live`; database-backed readiness is at `/health/ready`. The API reference is at `/api/docs`.

[Operating and security notes](docs/OPERATIONS.md) · [Free hosting assessment](docs/HOSTING.md)

## Develop without containers for the application

A real PostgreSQL 17 server is still required. With it listening locally:

```sh
npm ci
export DATABASE_URL=postgres://atlas:atlas-local-only@localhost:5432/atlas
export DEMO_MODE=true DEMO_PASSWORD='AtlasDemo!2026'
export APP_ORIGIN=http://localhost:5174 COOKIE_SECURE=false
npm run migrate
npm run seed
npm run build
npm run dev:api
# In another terminal:
VITE_DEMO_MODE=true npm run dev:web
```

The API development command watches compiled files; rerun `npm run build --workspace api` after changing API source. The web dev server proxies requests to API port 3000.

## Scope and ownership

Built by [Cadrien Studio](https://cadrienstudio.com), contact@cadrienstudio.com. This is an inspectable reference application, not a claim of paid client delivery, penetration-test certification or long-term production operations. See the operating notes before adapting it for real companies and personal data. Public visibility permits review under GitHub's terms; no additional software license is granted here.
