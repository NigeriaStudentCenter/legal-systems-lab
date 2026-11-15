# LexFlow CPD Backend — PostgreSQL / Azure Container Apps

**Status:** GitHub source only; not deployed to an Azure Container App or connected to PostgreSQL. This is a development scaffold, not yet security-tested for production. NBA-ICLE accreditation and regulatory reporting are not established.

## Runtime

Node.js 20+ API with `pg`, PostgreSQL 15+, JWT validation using `ENTRA_ISSUER`, `ENTRA_AUDIENCE`, `ENTRA_JWKS_URI`, and a managed-identity Azure AI tutor. Run as a container in **Azure Container Apps** on **port 8080**.

Mandatory database settings: `DATABASE_URL` (supply securely as a Container Apps secret) and `DATABASE_SSL=true`. TLS certificate validation is required (`rejectUnauthorized: true`). The PostgreSQL server must present a trusted certificate. Do not disable certificate verification to work around an error. Secure the DB with network restrictions, backup, auditing, and encryption.

### Container lifecycle

- `GET /healthz`: liveness, returns 200 if process is handling requests; deliberately does not query the DB.
- `GET /readyz`: readiness, performs a read-only `SELECT` against `cpd_users`, returns 503 if DB access/schema is unavailable.
- Container listens at `0.0.0.0:8080`.
- No migrations or other DDL execute at startup. No DELETE statements.
- On SIGTERM the process drains HTTP requests and closes the `pg` pool.

### Database schema and migration responsibility

Read [sql/README.md](sql/README.md). Apply `sql/001_initial.sql` to an empty PostgreSQL 15+ database through a *separate, operator-controlled DDL migration identity*. The application uses **SELECT, INSERT, UPDATE only** on specified CPD tables. It must have no CREATE, ALTER, DROP, TRUNCATE, DELETE, ownership or schema-management rights. Configure secure runtime grants with the privileged operator, not through the app.

The SQL tables cover `cpd_users`, `cpd_course_sessions`, `cpd_session_faculty`, `cpd_enrolments`, `cpd_attendance_events`, `cpd_course_approvals`, `cpd_certificates`, and `cpd_audit_events`. User identities are explicitly provisioned by an administrator after identity verification, never by a public self-assignment endpoint.

### Azure Container Apps deployment

1. Provision Azure Database for PostgreSQL Flexible Server (or another approved managed PostgreSQL service), database and network access. Set TLS to require certificate validation.
2. Apply migration 001 with a separate migration operator; set least-privilege runtime grants.
3. Build the Dockerfile from the `backend/` directory (use an immutable image tag in your container registry).
4. Create an Azure Container Apps environment and the `lexflow-cpd-api` Container App with external HTTPS ingress, target port **8080**, appropriately sized resources and health/readiness probes.
5. Store `DATABASE_URL` as a Container Apps secret; map via secretRef. Configure `DATABASE_SSL=true` and the Entra settings. Assign a managed identity and Azure AI permissions if using the tutor.
6. Protect DB connectivity using secure private networking where supported, run smoke tests for `/healthz` and `/readyz`, then test restricted API access with a fictional learner.
7. Update public `auth-config.js` **only after** the Azure URL and Entra identifiers are available and approved. This migration does not modify that file.

### API controls and outstanding blockers

Authenticated `/api/me`, sessions, learner check-in, faculty attestation, internal-report preview and AI tutor routes are preserved and use parameterised SQL. Self-check-in remains unverified, faculty evidence is pending independent compliance review, certificate *issuance is disabled* until the approval workflow is built, and any public verification only checks pre-existing issued records. No NBA-ICLE credits are awarded by the current API.

This remains a scaffold. Before real records: implement auditable attendance approval, granular privacy rights, operational backup and recovery, safe user lifecycle, DB privilege testing, authentication integration tests, assessment verification, certificate revocation, AI prompt/abuse controls, request quotas in a distributed rate limiter, GDPR/NDPA review, and independent security assessment.

Do not place production credentials, learner data or privileged legal documents in GitHub.
