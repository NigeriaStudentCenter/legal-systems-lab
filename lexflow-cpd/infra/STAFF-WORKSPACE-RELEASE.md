# LexFlow CPD staff workspace release gate

**Committed:** `lexflow-cpd/staff.html`, `staff.js`. This is a browser user-interface build. It does NOT deploy a new Azure Container App revision or migrate the Azure database.

## Identity setup required before signing in

In the **existing** `LexFlow-CPD-Portal` Microsoft Entra application registration, Authentication → Single-page application → Redirect URIs, add:

`https://legal.bsoedu.org/lexflow-cpd/staff.html`

Keep the existing learner portal redirect URI. Do not modify `lexflow-cpd/auth-config.js` as part of this release. The staff workspace shares the existing public identifiers and API target.

The account's role comes from the protected `cpd_users` PostgreSQL table. An authorised operator must explicitly provision fictional faculty/admin identities and assign faculty to sessions. Never allow unapproved self-service role elevation.

## API prerequisites

This interface calls protected API routes introduced in the **newer GitHub backend source**:

- `GET /api/faculty/sessions`
- `POST /api/attendance/attest`
- `POST /api/assessments/:id/decision`
- `GET /api/admin/attendance-reviews`
- `POST /api/attendance/:id/review`
- `GET /api/admin/completions?sessionId=<UUID>`
- `POST /api/certificates/issue`
- `POST /api/certificates/revoke`
- `POST /api/certificates/verify`

The documented Azure development image `sha256:b08ae65c...` is older. **Do not expect these routes to work live until**:
1. A migration operator applies `sql/002_review_assessment_certificates.sql` to the CPD database and grants only SELECT/INSERT/UPDATE to the runtime identity on the four added tables.
2. The GitHub CPD API image workflow finishes with passing tests and creates an immutable digest.
3. An operator updates `infra/dev.parameters.json` with the approved digest and redeploys `dev.bicep`.
4. The new Container App revision passes `/healthz`, `/readyz`, protected-role integration tests, API report restrictions and certificate issue/revoke tests.
5. No real learner, client or privileged information is loaded in the shared development environment.

## Limitations and privacy

The faculty panel exposes fictional assessment response text and attendance evidence to authorised faculty, whereas the compliance panel exposes attestations to authorised admins. Access is enforced by the API and must be retested. The public certificate check does not require login, and the reference must be unpredictable.

No NBA-ICLE accreditation has been verified. BSOE certificates and any credit fields must not imply NBA-ICLE status without written authorisation. This interface is for fictional-data development only.

## Suggested acceptance tests (synthetic users only)

1. Entra redirect back to `staff.html` with an operator-created faculty account.
2. Faculty can see only assigned sessions and mark an assessment; cannot access admin reviews.
3. Admin can review faculty attendance; cannot create faculty attestations.
4. Self check-in alone cannot be approved or trigger certificate issuance.
5. Certificate requires passed assessment and independently approved attendance, can be revoked, and verification reflects revocation.
6. Incorrect token audience or unprovisioned identity yields 401/403.
7. Confirm database runtime still cannot DELETE or execute DDL.
