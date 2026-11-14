# LexFlow NG initial threat model

**Protected assets:** lawyers' identities and credentials, verification decisions, login tokens, professional reputations, public integrity, auditor evidence. Client legal matters are explicitly excluded from Phase 1.

### Trust boundaries
- Browser → HTTPS API: never trust claimed user role, professional standing, names or fees.
- API → OIDC issuer: validate signature, issuer, audience, expiry and approved algorithms using remote JWKS; reviewer permission is read from private DB.
- API → PostgreSQL: parameterised queries; role separation, private networking, per-service DB credentials; avoid logging sensitive fields.
- Reviewer → official sources: separate human source verification, at least two reviewers; applicant cannot self-review; publisher must be independent.
- API → public directory: only approved, unexpired published profiles, minimum necessary public fields.

### Threats and initial mitigations
1. Self-verified fake lawyer: applicant input never grants role; two reviewers + independent publisher, official reference checks.
2. Insider who attempts to approve and publish own profile: owner check and publishing reviewer independence.
3. Mass scraping: no case data; per-IP limits, low page sizes, pagination limits; monitoring / query rate control needed in gateway.
4. Broken object-level authorisation: own application found from authenticated OIDC subject; admin review role checked server-side.
5. JWT forgery or token for other app: JWKS verification restricted algorithms and issuer/audience; short-lived tokens with rotation recommended.
6. SQL injection: bound parameters; no user-supplied identifiers/SQL.
7. XSS and bad advertising: strict length/field validation; output is plain JSON; client must render with textContent and add human moderation.
8. Confidential data exposure: client matter system not implemented; no sensitive upload endpoint.
9. Cross-tenant access: no firms or tenant matters in this phase; future design needs ABAC and tenant isolation.
10. Service outage: feature gates all off by default; health checks, capped body size, rate limits; backups and DR still outstanding.
11. Inaccurate professional status: source reference and valid-until date; automatic expiry exclusion; suspension and appeal process.
12. Escrow misrepresentation: no transaction processor or custody account; do not claim payment protections without a regulated framework.

### Known gaps
- No independent pentest or lawyer verification agreement.
- No hosting, identity provider, production DB, operator on-call, email verification, audit exports, document vault or live AI.
- No automated removal upon professional-regulator status change; must build before broad scale.
- Reviewer source checks rely on human evidence; technology does not itself contact NBA registers.
- Insufficient monitoring, event alerts, abuse/risk scoring and internal admin UI.
- Need DB integration tests, log redaction audits, end-to-end auth tests and DPIA.

## Direct-to-lawyer payments (added 14 November 2026)
- **Account substitution**: an attacker who takes over a lawyer login replaces the bank account. Control: every change needs two independent reviewers to re-confirm the account name before clients see it; issued invoices keep their original snapshot; all changes audited. Residual: reviewers match names by hand, there is no bank name-enquiry check.
- **Phishing link as payment page**: control: only `https://paystack.com/pay/…` or `https://paystack.shop/pay/…` with no query string. Residual: anyone can create a Paystack page, so the page owner's name still has to be checked by reviewers.
- **False "paid" status**: a lawyer reports payment that never arrived, or a client disputes a real one. Control: status is labelled as reported, the client can dispute, both actions are audited. LexFlow does not adjudicate.
- **Enumeration of engagements or invoices**: non-parties get the same 404 as for a missing record.
- **Case facts leaking into billing records**: no free-text fields on engagements or invoices; reference codes limited to capitals, digits, hyphen and slash.
- **Client personal data**: name and one contact, visible only to the chosen lawyer. Needs a client privacy notice and DPIA before the gate opens.
