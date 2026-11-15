# LexFlow NG — what personal data the system collects, and gaps (15 November 2026)

Prepared from the code and schema on `main`. This is a technical audit, not a legal opinion or a DPIA.

## Data collected
| Who | Data | Where held | Why it is needed | Who can see it |
|---|---|---|---|---|
| Every signed-in user | Email, password hash, display name | Microsoft Entra External ID (Europe) | Sign-in | Tenant administrators |
| Every signed-in user | Opaque Entra subject ID, role, active flag | `app_users` | Link sign-in to records | API only |
| Lawyer applicant | Full name, state, city, year of call, practice areas, languages, 25–350 character summary, time of privacy acknowledgement and verification consent | `lawyer_applications` | Listing and verification | Applicant, reviewers; public once published |
| Lawyer applicant | Verification source type, source reference, dates, any rejection reason | `verification_reviews` | Evidence of the check | Reviewers only; never public |
| Verified lawyer | Account name, bank name and 10-digit account number, or own Paystack page address | `lawyer_payment_details`, copied onto each invoice | So clients can pay the lawyer directly | Lawyer, reviewers, that lawyer's clients |
| Client | Name, one contact (email or phone), practice-area label, time of direct-payment acknowledgement | `engagements` | So the chosen lawyer can reply | Client and that lawyer only |
| Client and lawyer | Invoice reference, fee label, amount, due date, reported-paid date, receipt number | `invoices` | Billing record | The two parties only |
| Staff and users | Who did what and when, with small metadata | `audit_events` | Accountability | Database operators |

## Not collected, by design
Client case facts or documents; identity documents; card or bank credentials; client money; roll or enrolment numbers in any public field; analytics or tracking; request bodies or tokens in logs (the API runs with logging off).

## What already limits collection
- Engagements and invoices have no free-text fields; labels come from fixed lists and references are restricted to capitals, digits, hyphen and slash.
- The public directory returns nine fields and nothing else (confirmed on staging).
- A non-party gets the same "not found" as for a record that does not exist.
- The runtime database login cannot delete rows or change the schema.

## Gaps to close before real data
| # | Gap | Risk | Suggested fix |
|---|---|---|---|
| 1 | No retention periods and no erasure or export path. Rows cannot be deleted and there is no data-subject request procedure. | Cannot honour erasure, access or portability requests | Decide retention per table; add an operator procedure and tooling for export, anonymisation and deletion |
| 2 | Consent timestamps do not record which version of the privacy notice was shown | Cannot prove what a person agreed to | Store the notice version with the acknowledgement |
| 3 | Bank account numbers are stored in clear text and copied onto every invoice | Wider exposure if the database is read | Encrypt at column level or store once and reference; restrict who can query |
| 4 | Free text in review rejection reasons, suspension reasons and the lawyer's summary | Staff may type personal or case details | Guidance for reviewers; consider fixed reason codes |
| 5 | Client name and contact are kept after an engagement is closed | Kept longer than needed | Remove or mask a set time after close |
| 6 | Staging shares a publicly reachable database server with other products | Unsuitable for real data | Dedicated private server in production (see hosting plan) |
| 7 | All processing is outside Nigeria (Azure Europe; Entra Europe) | Cross-border transfer needs a lawful basis | Counsel to confirm the transfer basis; consider an African region |
| 8 | Reviewer and publisher roles are granted by hand in the database with no change log | Privileged access not evidenced | Controlled procedure with a second approver and a record |
| 9 | Platform logs (ingress, container console) have not been reviewed for IP addresses or identifiers | Unplanned personal data in logs | Review log content and retention before launch |
| 10 | Multi-factor sign-in is not enforced and password recovery is untested | Account takeover, especially of lawyers who control payment details | See MFA section of the sign-off pack |
| 11 | Reviewer identity is keyed on the Entra `sub` claim, which can differ between applications in the same tenant | A role granted against one application's subject may not match another's | Confirm with a browser token before granting production roles; consider keying on object ID |

None of these gaps has been fixed in code yet. Items 1, 2, 3 and 5 need schema or API changes.
