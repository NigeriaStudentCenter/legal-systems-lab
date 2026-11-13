# LexFlow NG Production Release Gates — not yet approved

| Control | Required evidence before enabling | Current |
|---|---|---|
| Nigerian professional conduct and remuneration review | Signed opinion from Nigerian-qualified counsel; advertising and fee rules | Not completed |
| Independent NBA/official verification method | Written source, authorised lookup process, appeals, renewal/expiry standard | Not completed |
| Data protection | Controller/processor roles; notice, DPIA, NDPA/GAID analysis, lawful basis, retention, DSAR and breach process | Not completed |
| Identity provider | OIDC issuer/audience/JWKS, MFA, recovery, tested onboarding and deprovision | Not provisioned |
| Hosting and encryption | Owned Azure or other tenancy, HTTPS gateway, trusted CA, WAF, secrets vault, secure network + backups | Not provisioned |
| Operations | Trained reviewers, independent publisher, audit access, incident pager and incident runbooks | Not staffed |
| Code review | All CI checks pass, independent security code review and pen test | Pending |
| Financial handling | No payments/escrow until regulated model and provider contract agreed | Disabled |
| Client portal and custody dispatch | Separate legal/privacy/safety reviews; no reliance on a mock workflow | Not implemented |
| Production data testing | Only synthetic fixtures during validation; enforce retention and erasure | Not approved |

## Suggested verification runbook
1. Receive applicant self-reported factual profile **without** any public verification label.
2. Verify legal identity, call to bar / roll details, practice credentials and current standing through a legitimately approved professional source. Keep a record of source and date in restricted review tables; do not expose IDs publicly.
3. Assign two distinct independent reviewers, each using a separate human-checked source reference; check any discrepancies. A rejection halts publication and triggers an appeal handling process outside this first slice.
4. Independently review advertising text and any disclosed fee menu against professional rules and LPRO.
5. A separate publishing officer (not one of the reviewers and not the applicant) approves publication.
6. Revalidate periodically. Listings are automatically hidden on expiry. A compliance administrator can suspend a listing immediately; adverse decisions require human appeals and appropriate notice.

## Production rollback
Turn off all `ENABLE_*` flags, stop public onboarding, revoke affected OIDC subjects, and close the origin at the gateway. Maintain the immutable change trail and statutory record retention. Database rollback needs an approved migration plan; never drop production tables to recover a failure.

## Operator sign-off
No sign-offs have been supplied. The default position is **DO NOT ENABLE PUBLIC APPLICATIONS**.
