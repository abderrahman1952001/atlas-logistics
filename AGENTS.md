# Development guide

Atlas is a standalone NestJS/PostgreSQL/React application. Keep authorization, company scoping and transaction invariants in the API. Do not substitute a mock or SQLite database for PostgreSQL integration tests.

Read README.md and docs/API-CONTRACT.md. Use Node24.19+, npm ci and the lockfile. After a code change, run npm run build and the relevant tests against a real stack; full release checks use docker compose and npm test. Never claim an unrun CI job passed. Synthetic seed accounts must stay opt-in and must never become production credentials. Keep private files and actual customer data out of this public repository.

The separate fast demonstration at cadrienstudio.com/operations is not hosted by this repository. Changes here must not silently replace it.
