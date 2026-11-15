# LexFlow NG — production release sign-off pack

**Status at 15 November 2026: no gate is signed. Public registration must stay closed.** This pack sets out, for each gate in `../backend/RELEASE-GATES.md`, the evidence that now exists, what is missing, and who must sign. Technical evidence can be produced by engineering; the signatures cannot.

## Evidence available today
| Evidence | Where |
|---|---|
| Automated tests: API, database rules, portal, browser journey | GitHub Actions on `main` |
| Read-only staging acceptance | `ops/README-STAGING-ACCEPTANCE.md`; run 43579893414 |
| Approved staging release with rollback | `ops/README-APPROVED-STAGING-RELEASE.md`; run 43593738277 |
| Genuine two-account browser sign-in | `portal/REAL-ENTRA-ACCEPTANCE.md` |
| Full journey on staging with real tokens, 41/41 | `ops/STAGING-JOURNEY-ACCEPTANCE.md` |
| Data collected and known gaps | `compliance/DATA-MINIMISATION-AUDIT.md` |
| Draft privacy notice | `compliance/PRIVACY-NOTICE-DRAFT.md` |
| Threat model | `backend/docs/THREAT-MODEL.md` |
| Production hosting proposal | `compliance/PRODUCTION-HOSTING-PLAN.md` |

## Gates
| # | Gate | Evidence so far | Still missing | Who signs | Signed / date |
|---|---|---|---|---|---|
| 1 | Professional conduct and remuneration (RPC 2023, advertising, fee display, invoicing through a third-party platform, client-account rules) | Product spec and payments model | Written opinion | Nigerian-qualified counsel | ☐ |
| 2 | Lawyer verification method | Two-reviewer and publisher flow proven on staging | Approved official source, lookup procedure, renewal standard, appeal procedure, trained reviewers | Counsel and head of verification | ☐ |
| 3 | Data protection | Audit and draft notice | Controller identity, DPIA, lawful-basis and transfer analysis, retention schedule, request and breach procedures, registration decision, fixes for audit gaps 1–5 | Data protection officer and counsel | ☐ |
| 4 | Identity | Sign-in proven; public sign-up off; MFA policy in report-only on staging | Production tenant, MFA enforced, recovery tested with real mailboxes, staff offboarding procedure | Security lead | ☐ |
| 5 | Hosting and encryption | Proposal only | Everything in the hosting plan, restore test | Owner and security lead | ☐ |
| 6 | Operations | None | Named reviewers and publisher, incident contact, runbooks, monitoring and alerts | Operations lead | ☐ |
| 7 | Code and security review | CI green; threat model | Independent code review and penetration test | Independent reviewer | ☐ |
| 8 | Financial handling | Custody permanently off in code; receipts say so | Counsel's confirmation that the direct-to-lawyer model raises no custody or licensing issue; tax treatment of invoices | Counsel | ☐ |
| 9 | Software subscriptions | Not built | Separate merchant account, pricing review | Owner and counsel | ☐ (not needed for pilot) |
| 10 | Client portal and custody dispatch | Not built for dispatch; client engagement API proven | Separate reviews | Counsel | ☐ (dispatch out of scope) |
| 11 | Production data testing | Synthetic data only so far | Approval for pilot data, retention enforced | Data protection officer | ☐ |

## MFA and account recovery: current position
- Staging tenant: a Conditional Access policy requiring MFA for the portal app exists in **report-only** mode. It is not enforced because the fictional accounts have no mailbox to receive a one-time code.
- Email one-time passcode must be enabled as a method in the tenant (Entra admin centre → Authentication methods) by a tenant administrator; this could not be read or set through the command line.
- Self-service password reset and MFA enrolment have **not** been tested end to end. That needs test accounts with real mailboxes.
- Production: enforce MFA for everyone, require it at every sign-in for reviewers and publishers, and remove any password-only client.

## Final release decision
All of gates 1–8 and 11 signed: ☐  Release authorised by (owner): ____________  Date: ________

Until that line is signed the default in `RELEASE-GATES.md` stands: **do not enable public applications.**
