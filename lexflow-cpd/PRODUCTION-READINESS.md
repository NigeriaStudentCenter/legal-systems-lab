# LexFlow CPD Academy: production readiness

**Status on 16 Nov 2026: a working, tested development platform with fictional data. It is not yet a production service.**
Nothing here may hold a real lawyer's record until every item under *Needs a decision* and *Needs people* is closed.

## Done and tested
| Area | What exists | Evidence |
|---|---|---|
| Sign-in | Microsoft Entra External ID; portal and staff pages; MSAL served from this site; Content-Security-Policy on both pages | Live sign-ins 15–16 Nov |
| Token checks | Signature, issuer, audience, expiry, **delegated permission `access_as_user`, tenant, approved app** | Automated tests in `backend/test/`; real tokens carry the expected claims |
| Roles | Learner / faculty / admin, held in the database and set by an operator; learners may self-register as learners only | Tests; live 27/27 |
| Separation of duties | Faculty attest and mark only their assigned sessions; admins review attendance and issue certificates but cannot attest; a reviewer can never approve their own attestation (database constraint) | Tests; live 27/27 |
| Certificates | Issued only after a passed assessment **and** independently approved attendance; public verification by reference; revocation with reason | Tests; live |
| Credits | 0 unless the session is linked to an approved, in-date course approval with an authority reference | Database constraint; tests |
| Data minimisation | No client data; confidential wording refused; tutor questions and answers never stored; learners never see faculty evidence | Tests |
| Database access | Runtime login: read/insert/update on CPD tables only, no delete, no schema change; TLS 1.2+ enforced | Tests; live checks |
| Audit | Every registration, enrolment, check-in, submission, decision, review, issue and revocation is written to `cpd_audit_events` | Tests |
| AI tutor | gpt-4.1-mini, EU data zone, default content filters, managed identity, 50/day total and 10/user caps (at most about $1.55 a month) | Live 16 Nov |
| Supply chain | Lockfile; base image pinned by digest; `npm audit` and Trivy image scan block a release; CodeQL; Dependabot | CI |
| Release | Image built only after tests pass; deployed by digest from `infra/dev.bicep` | `infra/DEV-DEPLOYMENT.md` |

## Engineering still to do (no decision needed)
1. **Browser tests in CI** for the portal and staff pages (sign-in mocked), like `lexflow-ng/backend/test/e2e`.
2. **Operator scripts in the repo** for provisioning faculty/admin roles and assigning faculty to sessions, so nobody types SQL.
3. **Data-subject requests**: export and correction for learners, as LexFlow NG already has (`/v1/me/data`), plus an operator erasure function.
4. **Retention job**: delete or anonymise tutor usage rows and audit details past an agreed period (needs the period, see below).
5. **Session management for admins**: create sessions and assign faculty through the staff page rather than the database.
6. **Remove the password-only test client** from the allowed apps in production.

## Needs a decision from BSOE
| Decision | Why it matters | Options / cost |
|---|---|---|
| **Production subscription** | Visual Studio credits are licensed for dev/test only, and the spending cap here would switch off every product if exceeded | Pay-as-you-go subscription |
| **Private production database** | The dev database sits on a server shared with other products' live data, open to all Azure services, 7-day backups, no geo-backup, no failover | Own PostgreSQL Flexible Server with private networking, 35-day backups and geo-redundant backup: roughly $15–30 a month on a burstable tier, more with high availability |
| **Production sign-in tenant** | The current tenant is for testing and contains password-only test accounts | New External ID tenant with **MFA (email one-time code) enforced** and self-service sign-up as BSOE decides; free up to 50,000 monthly users |
| **Monitoring and alerts** | Nobody is told today if the API fails | Azure Monitor alerts on 5xx responses, restarts and tutor spend: a few dollars a month at most |
| **Retention periods** | Needed for the privacy notice and the retention job | e.g. certificates kept permanently for verification; attendance and assessments N years; tutor usage 90 days |
| **Verified learner names** | Certificates currently print the name from the user's Microsoft profile, which the user can edit | Match against the NBA roll, or verify by a document check at registration |
| **Enrolment (SCN) numbers** | NBA-ICLE participant lists will very likely need them; the platform does not collect them | Collect only if the regulator requires it, after updating the privacy notice |
| **Pass mark** | 7/10 is taken from the demonstration rubric | Course director confirms |

## Needs people
- **NBA-ICLE accreditation** for each course, with the authority reference recorded in `cpd_course_approvals`. Until then every certificate shows 0 credits.
- **NBA-ICLE reporting format**: public sources say an accredited provider gives 30 days' notice of an activity and submits a participant list afterwards, but no official field list or format was found. Obtain the provider guidance or a sample return; the export will be built to match it.
- **Privacy notice and data protection** (NDPA 2023): approved notice, lawful basis, DPO or responsible person, data-processing records.
- **Independent security review / penetration test** of the API and pages before real records.
- **Named faculty and administrators**, each with their own account, and a written procedure for attendance review and certificate issue.

## Suggested route to launch
1. Close the engineering items above on the development platform.
2. BSOE decides subscription, database, tenant and monitoring; build production from `infra/` with those choices.
3. Privacy notice approved; security review passed; NBA-ICLE accreditation for the first course.
4. **Pilot**: one cohort of invited lawyers, monitored, with a rollback plan.
5. Open registration after the pilot review.
