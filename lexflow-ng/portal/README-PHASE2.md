# LexFlow NG — Client and lawyer portal Phase 2

**Development status: new UI only; no live public rollout.** The existing staging backend and direct-to-lawyer APIs are unchanged. The user-supplied staging status is documented in \`../infra/HYBRID-STAGING.md\`; the staging environment is synthetic-only and cannot be used for real clients.

## Screens
- \`client.html\`: list approved professional profiles, create a minimal enquiry, see own engagements and invoices, confirm/dispute lawyer-reported payments, download lawyer-issued receipt record.
- \`lawyer.html\`: review client enquiries, confirm a conflict check before acceptance, manage lawyer-owned payment instructions, issue invoices, report money received in a lawyer-owned account, void invoices and download receipts.
- \`src/engagements.mjs\`: MSAL authentication, authenticated API interactions and safe DOM construction using \`textContent\` for server-originated data.
- \`src/engagements-runtime.mjs\`: pure input validation and formatters, with direct-to-lawyer payment and receipt notices.
- \`engagements.css\`: responsive styling.

## Explicit safety boundaries
- No real intake: \`portal/config.js\` has \`enabled:false\` on the development branch. These files are not deployed to the public site.
- The Azure staging \`ENABLE_ENGAGEMENTS\` gate must remain \`false\`. UI config alone cannot authorize server access.
- Professional profiles come from a verified-only backend directory (it will return 503 while that feature is disabled).
- No card data, case facts, detention details, documents or criminal allegations are requested.
- Clients pay an independently reviewed lawyer/firm payment account or the lawyer's own approved Paystack page. LexFlow never initiates, splits, holds or receives client legal fees.
- A lawyer-reported payment and client confirmation do not constitute Paystack or bank verification. Generated receipts carry the exact notice.
- Business endpoints authorize access server-side and restrict engagements to the client and appointed lawyer.
- Frontend limits are convenient UX and do not substitute for the backend's stricter field, permission, jurisdiction and money validation.
- No public release until NDPA privacy/DPIA, written Nigerian professional-conduct review, independent credential verification, tenant segregation, MFA, incident response and security review.

## Development steps
\`\`\`sh
cd lexflow-ng/portal
npm install
npm run check
npm test
npm run build
\`\`\`

The build generates \`dist/portal.js\` and \`dist/engagements.js\`. Both must be deployed alongside the corresponding HTML and CSS. Do not edit \`config.js\` to \`enabled:true\` or move these pages to the public \`main\` branch before all production release gates are satisfied.

## Next integration test plan
1. Azure identity: test popup authentication in the correct External ID tenant, including account switching, logout, consent and session expiry.
2. Backend feature gate: confirm every engagement endpoint returns 503 when off and 401 for anonymous callers when enabled.
3. With synthetic verified lawyer profiles, test selecting a real server-listed lawyer and submitting only minimal contact/area fields.
4. Validate ownership: lawyer cannot read another lawyer's engagements, client cannot read another client's invoices; reviewer cannot become client.
5. Verify payee account changes require two independent reviewers, while old issued invoices remain unchanged.
6. Simulate invoice, lawyer's payment report, client confirmation or dispute, and receipt accuracy. No money should move.
7. Test low-bandwidth mobile web, assistive technology, keyboard access, blocked login popup and connection interruptions.
8. Move to isolated paid production Azure resources only after formal approval; the shared Visual Studio subscription remains test-only.
