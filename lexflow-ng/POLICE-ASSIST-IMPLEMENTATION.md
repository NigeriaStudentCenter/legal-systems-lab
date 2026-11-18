# LexFlow NG Police Legal Assistance Network — Build and launch plan

Status: **working static simulation deployed to GitHub repository; not production**. Public entry: `lexflow-ng/police-assist.html`.

## What is implemented
- Unified citizen interface: fictional station selection, custody / police bail / court / free-aid service filters.
- Geographic nearest-lawyer matching using haversine straight-line distance; selectable radius.
- Simulated identity and practice-status gate, availability and free legal-aid filters.
- Client-side demo referral preview, simulated acceptance, session-only tickets, export and reset.
- Lawyers' process checklist, legal-rights guide, suggested commercial model.
- All lawyers/stations invented; no case details collected, no police API, no real dispatch or payment.

## Production launch stages and acceptance gates

### A. Reliable geographic data
- Ingest public station source data with explicit licensing/provenance. Do not silently treat historic GIS features as verified current stations.
- Versioned table: station_id, formation_type, name, alternate_names, state, LGA, address, geom(Point,4326), provenance, source_date, verification_status, verified_at.
- Administrative moderation for duplicate merge and takedown/correction requests.
- No public detainee directory or arrest-record search.

### B. Lawyers and professional verification
- Entra External ID or comparable hardened identity provider, MFA for lawyers and admins.
- Independent NBA roll/current-practice checks through lawful sources; no automatic reliance on self-declared badges.
- Lawyer competencies, languages, availability slots, area served, aid eligibility, conflicts and acceptance policy.
- Audit verification evidence and expiry. Verification badge only after actual checks; never infer solely from uploaded documents.

### C. Confidential intake, dispatch and case management
- API behind Azure Front Door/WAF with throttling and abuse detection.
- Azure Container Apps or equivalent managed services; Azure Database for PostgreSQL/PostGIS with private network access.
- Key Vault, TLS, encryption at rest, least-privilege identity, object-level authorization, immutable audit events and backups.
- Intake states: unverified report -> professional assignment pending -> professional acceptance after conflict checks -> privately confirmed details -> ongoing matter -> closed. Never present an unverified family report as confirmed custody.
- Capture minimal personal data; secure messaging and attachment handling only after privacy/security and legal-professional review.
- Security and data-protection impact assessment, retention schedule, access-request process, incident response and applicable cross-border transfer assessment.

### D. Legal aid and payments
- Free legal-aid directory and public-rights content available without payment.
- Real legal-aid status and intake confirmed by actual participating providers; no implied council partnership.
- Paid practice-management subscriptions may be explored after legal ethics, professional remuneration and consumer protection reviews.
- No police bail fee, facilitated release charge, purchase of custody records or guaranteed outcome. Do not implement unreviewed per-lead referral commission.

### E. Operational monitoring
- Published uptime and support process; queue age, assignment acknowledgement, first contact times, accessibility testing, false claims, moderation outcomes and capacity monitoring.
- Human oversight, explicit complaint/escalation channels, anti-fraud measures and regular legal-content revision.
- Keep official police systems outside the data boundary absent separate authority. Station listing is not partnership.

## Suggested schema
`stations(id, name, state, lga, geom, provenance, verification_status, verified_at)`
`lawyers(id, verification_state, verified_at, languages, areas_of_practice, lat, lon, accepting_matters)`
`availability(lawyer_id, starts_at, ends_at, channel, capacity)`
`referrals(id, requester_id, station_id, service_type, urgency, consent_record_id, status, assigned_lawyer_id)`
`referral_events(id, referral_id, actor_id, event_type, occurred_at)`
`legal_aid_programmes(id, provider_id, eligibility_terms, status, verified_at)`
`subscriptions(id, organisation_id, plan_id, status)`
Separation of privileged legal records from station directory is required; access to an organisation's unrelated cases must always be denied.

## API plan (not implemented)
`GET /v1/stations?state=&q=&bbox=` public validated stations
`GET /v1/lawyers?station_id=&service=&available=&aid=&radius_km=` public eligible profiles
`POST /v1/referrals` authenticated, consent-aware, idempotent; protected against spam
`GET /v1/referrals/:id` authorised requester / assigned counsel only
`POST /v1/referrals/:id/accept` verified professional only; conflict confirmation required
`POST /v1/referrals/:id/events` limited to designated role

## Release rules
Static demo may be hosted publicly; **no production case collection** on GitHub Pages.
Do not publish real users' names, arrests, complaints or client data in repository code, issues, workflow logs or public analytics.
Complete Nigerian-law review, privacy/security reviews, real provider verification, load and abuse testing before enabling live operation.

## Verification checklist
- [x] Unified frontend demo created
- [x] Marketplace navigation linked
- [ ] Real verified station inventory
- [ ] Professional verification integration
- [ ] Secure production backend
- [ ] Confidential intake and engagement terms
- [ ] Professional ethics / regulatory sign-off
- [ ] Security and legal review
- [ ] Accessibility and device field tests
- [ ] Controlled live pilot
