# LexFlow CPD Backend — PostgreSQL / Azure Container Apps

**Status:** The documented fictional-data Azure development environment was previously deployed and tested on 16 November 2026 (see [deployment record](../infra/DEV-DEPLOYMENT.md)). This newer lesson/case tutor build is **committed only** and has not been confirmed deployed as a new Azure revision. NBA-ICLE accreditation and regulatory reporting remain unestablished.

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

Read [sql/README.md](sql/README.md). Apply `sql/001_initial.sql`, followed by `sql/002_review_assessment_certificates.sql`, using a separate migration identity to a new PostgreSQL 15+ database through a *separate, operator-controlled DDL migration identity*. The application uses **SELECT, INSERT, UPDATE only** on specified CPD tables. It must have no CREATE, ALTER, DROP, TRUNCATE, DELETE, ownership or schema-management rights. Configure secure runtime grants with the privileged operator, not through the app.

The SQL tables cover `cpd_users`, `cpd_course_sessions`, `cpd_session_faculty`, `cpd_enrolments`, `cpd_attendance_events`, `cpd_course_approvals`, `cpd_certificates`, `cpd_audit_events`, and migration-002 review, assessment and tutor metering tables. Fictional learners may self-register in the development tenant when enabled, but faculty/admin roles must be independently provisioned by an authorised operator.

### Azure Container Apps deployment

1. Provision Azure Database for PostgreSQL Flexible Server (or another approved managed PostgreSQL service), database and network access. Set TLS to require certificate validation.
2. Apply migrations 001 and 002 using a separate migration operator; set least-privilege runtime grants.
3. Build the Dockerfile from the `backend/` directory (use an immutable image tag in your container registry).
4. Create an Azure Container Apps environment and the `lexflow-cpd-api` Container App with external HTTPS ingress, target port **8080**, appropriately sized resources and health/readiness probes.
5. Store `DATABASE_URL` as a Container Apps secret; map via secretRef. Configure `DATABASE_SSL=true` and the Entra settings. Assign a managed identity and Azure AI permissions if using the tutor.
6. Protect DB connectivity using secure private networking where supported, run smoke tests for `/healthz` and `/readyz`, then test restricted API access with a fictional learner.
7. Verify the existing Entra and public identifier configuration. **Do not overwrite `auth-config.js` in this release.**

### API controls and outstanding blockers

Authenticated `/api/me`, sessions, learner check-in, faculty attestation, internal-report preview and AI tutor routes are preserved and use parameterised SQL. Self-check-in remains unverified, faculty evidence is pending independent compliance review, certificate *issuance is disabled* until the approval workflow is built, and any public verification only checks pre-existing issued records. No NBA-ICLE credits are awarded by the current API.

This remains a scaffold. Before real records: implement auditable attendance approval, granular privacy rights, operational backup and recovery, safe user lifecycle, DB privilege testing, authentication integration tests, assessment verification, certificate revocation, AI prompt/abuse controls, request quotas in a distributed rate limiter, GDPR/NDPA review, and independent security assessment.

Do not place production credentials, learner data or privileged legal documents in GitHub.


### Extended lesson and case tutor (new source release)

The protected `POST /api/tutor` endpoint accepts either an optional, validated `lessonId` (`0-0` through `4-3`) or a bounded `caseId` (`authority`, `amendment`, `contract`, `privacy`, `pilot`) paired with integer `investigationStage` (0–4). Unknown or mixed selectors return HTTP 400. It does not accept arbitrary system instructions, workbook exports or uploaded case files. The public portal sends only the selector and a learner's explicitly typed question; course/case context is controlled by `tutor-curriculum.mjs` and `tutor-investigations.mjs` inside the container.

The AI tutor remains an educational coach, not a legal source, evaluator or certificate issuer. It uses existing `cpd_tutor_usage` records to meter counts and tokens without storing questions or responses. This update changes **no database schema or grants**. It requires a new tested and scanned Docker image, approved immutable digest, manual Azure operator deployment, and fictional-account acceptance tests. See [phase handoff](../infra/PHASE7-CONTENT-RELEASE.md).

The public `guided-investigations.html` and `capstone.html` are browser-local educational activities. Their local answers are not transferred to the authenticated backend as assessments unless the participant separately submits through the actual approved API and faculty process.

