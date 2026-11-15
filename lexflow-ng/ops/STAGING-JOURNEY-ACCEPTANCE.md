# LexFlow NG — full staging journey with real Entra tokens (15 November 2026)

**Result: 41 of 41 checks passed.** Synthetic accounts and records only. Staging was opened for about two and a half minutes (06:52:55–06:55:13 UTC) and closed again; the repository's read-only acceptance script and release guard both passed afterwards.

## What was exercised
Five fictional accounts in the `lexflowngstaging` tenant (client, lawyer, two reviewers, publisher) each obtained a real Entra-issued access token, and the deployed Azure API (`lexflowstg-api`, image `sha256:874a5698…`) validated every one.

| Stage | Checks | Outcome |
|---|---|---|
| Sign-in diagnostic | No token refused (401); all five tokens accepted (200); response carries no identity or data | 6/6 |
| Verification | Lawyer cannot self-review; client cannot see the queue; one review is not enough; a reviewer cannot approve twice or publish; two reviewers then a separate publisher succeed | 11/11 |
| Directory | Empty before publication, one listing after; listing exposes only name, location, year of call, practice areas, languages, summary and verification expiry | 2/2 |
| Payment details | Client cannot register them; lawyer can; invoice refused until two reviewers confirm the account name | 5/5 |
| Engagement | Client requests; duplicate refused; lawyer cannot engage self; client cannot accept own request; lawyer accepts after conflict check | 5/5 |
| Invoice and receipt | Lawyer issues; client sees it; outsiders get 404; no receipt before payment is reported; only the lawyer can report, only the client can confirm; receipt states LexFlow did not handle the money | 10/10 |
| Close-out | Lawyer completes; each party lists engagements; client contact is visible to the lawyer only | 2/2 |

`/v1/meta` reported `payments:false` and `legal_fee_custody:false` throughout.

## Limits of this test
- Tokens came from the tenant's test-only password client, not the browser. The browser sign-in was proved separately (`portal/REAL-ENTRA-ACCEPTANCE.md`); the browser tokens themselves were not sent to the API.
- The portal's own pages (pop-up sign-in, forms) were not used; this drove the API directly.
- Reviewer and publisher roles were inserted into the staging database by an administrator, as the design requires. That manual step has no tooling or change log yet.
- Rejection, suspension, dispute, void, decline and cancel paths were covered by the automated database tests, not re-run here.
- One user, one request at a time. No load, penetration or abuse testing.

## Left on staging
Synthetic accounts `synthetic.client1`, `.applicant1`, `.reviewer1`, `.reviewer2`, `.publisher1` (passwords in Key Vault), one published synthetic lawyer, one approved synthetic bank detail, one completed engagement with one confirmed invoice. All fictional.
