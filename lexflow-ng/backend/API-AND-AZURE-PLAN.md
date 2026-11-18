# Police Legal Assistance — API contract and release gates

**Status:** Design contract only. No Azure service, database, authentication, or live data is deployed.

## Public endpoints
- `GET /v1/stations?state=&q=&lat=&lon=&radius_km=` — only publish station records with provenance and their actual verification level; never detainee/custody data.
- `GET /v1/lawyers?station_id=&service=&available=&free_aid=&radius_km=` — publish only actively verified profiles with the lawyer's express consent; do not disclose exact private lawyer coordinates.
- `GET /v1/legal-aid/programmes` — participating organisations with independently confirmed eligibility/contact information and timestamps.

## Confidential endpoints (authenticated)
- `POST /v1/referrals` — intake of minimum necessary information with explicit consent, anti-abuse throttling, idempotency key, no automatic claim of confirmed custody.
- `GET /v1/referrals/{id}` — only a requester with verified entitlement or assigned legal professional.
- `POST /v1/referrals/{id}/accept` — only an independently verified, active lawyer after conflict check and client engagement requirements.
- `POST /v1/referrals/{id}/events` — authorised actors, append-only audit.
- `POST /v1/professionals/onboarding` — authenticated lawyer applicant, private encrypted evidence uploads.
- `POST /v1/admin/professionals/{id}/decision` — authorised reviewers, two-person approval for sensitive state changes.

## Response conventions
Return a machine-readable code and message, never internal logs or personal data in errors:
```json
{"error":{"code":"STATION_NOT_FOUND","message":"No matching station record."}}
```
Use RFC 7807 style problem details if adopted uniformly. Pagination and rate limiting required.

## Mandatory security conditions
1. External identity provider, short-lived access tokens, MFA for practitioners and reviewers.
2. Organisation-scoped and referral-scoped authorisation enforced at query time (not only on UI).
3. Public and restricted data separated by API, database policies, private networking.
4. Payload validation, consent records, server-side rate limits, spam prevention, abuse alerts.
5. Structured telemetry with sensitive-field redaction; no custody content in analytics.
6. Encryption keys via Azure Key Vault; managed identities; least-privilege DB accounts.
7. Backups and disaster-recovery tests, retention schedules and verified deletion.
8. Privacy/DPIA, lawyer confidentiality review, legal-aid eligibility and fee ethics review.
9. Accessible, multilingual, low-bandwidth user journeys, human-assisted fallback.
10. Public site must visibly distinguish directory status from an official police partnership.

## Azure deployment target
- GitHub Pages for public static presentation only.
- Azure Front Door/WAF -> private Container Apps API -> private Azure Database for PostgreSQL Flexible Server + PostGIS.
- Entra External ID for public users/lawyers where appropriate, with distinct administrative trust boundaries.
- Key Vault, Monitor, Application Insights configured to avoid sensitive-data capture.
- CI: lint + unit + integration + authz + accessibility + dependency + secret scans. Deploy to isolated development, staging, production subscriptions/environments.
- Infrastructure as code reviewed against actual Azure subscription and region before provisioning.
- Payment integration only after law/ethics and consumer protection review; no charges for police bail.

## Development gates
**Gate 1:** fictional UI, no secrets or user information, interactive browser-only demos (complete).
**Gate 2:** private development API and synthetic database, automated RBAC tests.
**Gate 3:** live lawyer identity validation and professional-review operating procedure.
**Gate 4:** real station source validation and geographic coverage quality checks.
**Gate 5:** independent privacy/security/professional legal approval.
**Gate 6:** limited, monitored pilot with appropriately verified lawyer service participants.
