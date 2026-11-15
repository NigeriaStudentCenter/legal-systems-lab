# LexFlow CPD Azure Backend — deployment scaffold only

**Status:** Source code prepared; NOT deployed to Azure or connected to GitHub Pages. This is an engineering starting point, not production-ready software or a regulatory reporting integration.

## Components
- Entra issuer/audience verification with remote signing keys; users require approved server-side role provisioning.
- Managed-identity Cosmos DB access.
- Azure OpenAI tutoring via managed identity (no keys in public website).
- Self-checkin events clearly marked unverified; faculty attestation pending a separate compliance review.
- BSOE completion-certificate API requiring completed session and approved faculty evidence. NBA credit field defaults to zero unless an approval record is independently established.
- Private administrator JSON report labelled **DRAFT INTERNAL REVIEW**. No NBA transmission.
- Minimal public certificate verification by unguessable reference.

## Required Cosmos DB containers and partition keys
Provision database named in COSMOS_DATABASE and containers:
| Container | Partition key |
| --- | --- |
| users | /id |
| sessions | /id |
| events | /partition |
| certificates | /partition |
| audit | /partition |
| approvals | /id |

Provision server role records with `id` equal to verified token `oid` (or `sub`), `role` = learner/faculty/admin, `active` = true. **Never provide user self-registration APIs that assign elevated roles**. A separate access-reviewed provisioning workflow is essential.

## Deploy
1. Set up Azure tenant and External ID app registrations for SPA and API, scope and permissions. Configure correct discovery issuer/JWKS and audience.
2. Provision Azure App Service (Node >=20) and a managed identity. Restrict network access as appropriate.
3. Provision Cosmos DB and its database/containers. Grant the App Service managed identity the necessary Cosmos data-plane roles.
4. Provision Azure OpenAI resource and model deployment. Grant the identity "Cognitive Services OpenAI User" as appropriate.
5. Set all environment values from `.env.example` in App Service configuration/Key Vault and configure `npm install && npm start` with locked dependencies.
6. Enable HTTPS, logging, WAF/rate limits, backups, alerts, vulnerability scans and policy-based retention. Restrict CORS origins.
7. Perform NDPA/privacy, threat-model, security and legal review; integration tests; teacher/manual approvals; record lifecycle controls and GDPR/NDPA response procedures before admitting real learners.
8. Once this deployment has a stable HTTPS URL, update SPA authentication with a proper authorization-code-with-PKCE flow; **never** embed API secrets or access tokens in source.
9. For NBA-ICLE, obtain approved provider/course reference, session reporting dates, required templates and an authorised submission procedure. Implement independently reviewed reports before claiming regulator integration.

### Additional release blockers
- No secure SPA identity/sign-in flow has been deployed.
- Faculty attestation remains `pending-compliance-review` with no approval operation yet; thus certificates cannot be issued in a fresh installation.
- Production requires stronger data-model constraints, unique certificate per completed enrolment, concurrency controls, explicit approval/denial workflows, audit immutability, reviewer separation of duties, session-limited consent, secure report minimisation, per-role filtering, expiry/revocation, and independent penetration tests.
- The report query and sample data should only be used with synthetic data until reviewed.
- Additional privacy-preserving content filter and abuse detection needed before AI tutor release.
- **Do not place actual learner records, Azure secrets, privileged source documents or production exports in GitHub.**

This repository contains no NBA-ICLE API specification or proof of accreditation.
