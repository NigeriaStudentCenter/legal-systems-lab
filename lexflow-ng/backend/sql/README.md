# Migration and administration guide

Use PostgreSQL 15+. `001_initial.sql` is a baseline migration for an **empty** controlled database.

Run migrations with an **operator** DB identity with DDL rights. The running API identity should have only SELECT/INSERT/UPDATE on the named tables, SELECT/USAGE on audit identity sequences, and no DDL or DELETE. Ensure row access is limited to the API rather than exposing the database to clients. Use private networking, backups, TLS and encrypted volumes.

**Manual admin provisioning only:** onboard the intended principal through a trusted OIDC identity provider, then perform a controlled SQL role change by an independent authorised operator:

```sql
-- Replace with a validated issuer subject; executed through private admin tooling.
INSERT INTO app_users (oidc_subject,role)
VALUES ('verified-provider-subject','reviewer')
ON CONFLICT (oidc_subject) DO NOTHING;
```

Grant 'publisher' and 'compliance_admin' only after written organisational authorisation. Changing roles through SQL must be documented in an external change log; do not expose an API for role assignment.

An applicant cannot self-review. It takes two independent reviewers and a separate publishing officer. Publication is gated by two current evidence-based reviews and a manual remuneration/advertising sign-off. Suspending is available only to compliance_admin.

**Never** move client evidence, criminal-case facts, detainee information, government ID images, attorney disciplinary records, banking credentials or privileged client instructions into this initial onboarding database or GitHub.
