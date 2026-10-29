# Operating Atlas

## Data lifecycle

PostgreSQL holds business records, users, hashed sessions, audit entries and notifications. The Compose volume survives container replacement. `docker compose down -v` deliberately deletes that local volume; use it only for disposable demonstrations.

Migrations run before the API starts. The sample seed is explicit and requires `DEMO_MODE=true` plus `DEMO_PASSWORD`. It should be used only with synthetic data. Never expose the sample accounts as a real business system.

## Release and recovery

Use the committed lockfile with `npm ci`. Run the full integration suite and restart proof before changing a deployed version. Database migrations must be reviewed independently from application rollback; reverting an image does not reverse a schema change.

For a database backup, run `pg_dump` with credentials from your secret manager and store the encrypted output outside the application host. Restore into a separate empty database and verify it before relying on the backup. This repository's automated checks prove application record persistence across PostgreSQL and API restarts; they are not a backup recovery certification.

## Before real company use

- Replace the demo seed with a controlled provisioning/onboarding process. Add recovery and email verification before offering self-service accounts; there is no outgoing email service here.
- Serve the gateway over HTTPS, set `APP_ORIGIN` to the exact HTTPS origin and enable secure cookies. The local Compose exception is HTTP on loopback only. Use private credentials and a restricted runtime database role; rotate secrets outside Git.
- Implement company membership administration and operational review processes appropriate to the actual business. The current application has fixed roles per account and administrator company review.
- Establish database backups, retention/deletion rules, monitoring/alerting, incident response, independent security review, load tests and data-processing requirements.
- Add document scanning, object-storage policies and access audits before accepting identity or business documents. This implementation focuses on requests, quotes, bookings and permissions; it does not upload verification documents.
- Validate external transport, messaging, payment and accounting integrations independently. None is simulated as a real completed service.

## Security boundaries

Role and company identity come from the authenticated database record. Client-supplied company/role fields cannot grant access. Sessions are revocable; logout invalidates the stored session. Cross-company reads and writes are checked by API policy. Audit rows are application records, not a tamper-proof compliance ledger against a database administrator.

The default demo deployment is one API instance. Rate limits and operational controls must be reassessed before horizontal scaling or public anonymous signup. Keep the database inaccessible from the public internet and run external migrations with appropriate privileges. Dependencies and container base images should be reviewed on each release; a clean dependency audit is not a security certification.

The API trusts no forwarded client IP by default. Compose opts into exactly one trusted proxy hop; Nginx overwrites the forwarded IP and the API has no public host port. Preserve this boundary if deploying elsewhere. Do not enable proxy trust when clients can reach the API directly. Lists are capped at 200 records and activity/notifications at 100; pagination and archival are required for larger datasets.
