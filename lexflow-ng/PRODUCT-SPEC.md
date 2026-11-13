# LexFlow NG — Product specification (research-led prototype, 13 November 2026)

## Product mission
Help Nigerian people discover appropriate legal support and help licensed practitioners—including BSOE Legal Systems Lab graduates—deliver accountable, timely, comprehensible services. **LexFlow is not a law firm or replacement for independent legal judgment.**

## Status
Static prototype only: sample professionals are fictional, no verification or legal advice, no client database, no dispatch, no court sync, no external AI, no payment/escrow. Local in-memory changes vanish on reload; exports are user-initiated.

## User roles and permissions
1. Public visitor: anonymous educational pathways and non-personal search by location/practice/language; no privileged data or feedback about actual lawyers.
2. Prospective client: real production phase only; authenticated enquiry, verified identity as appropriate, informed privacy notices, lawyer-controlled engagement, private messaging, milestone visibility.
3. Practising lawyer: verified roll/enrolment and current standing, firm membership, controlled matter access, confidentiality, trust accounting boundaries.
4. Firm administrator: manage membership, billing for software subscriptions, audit logs; no blanket read access to client privileged records without professional basis.
5. Verification officer: review documents, mark verification outcomes, revalidate periodically, suspend and provide appeal process.
6. Compliance officer: moderate adverts, claims, fees, legal-publishing boundaries and allegations, including lawyer complaints.
7. Trainer/graduate: sandbox and incubator only; course completion is NOT evidence of being called to the Nigerian Bar.

## Public marketplace
- 36 states and Federal Capital Territory in six geopolitical zones, with town/LGA support in later release.
- Search dimensions: practice area, state, city/LGA, spoken language, service channel, availability updated by lawyer, accessibility and actual independently verified status.
- Profile: factual name, roll identification internally, year of call, practice details, responsible individual or firm, verification date, geographic reach, professional contact method and privacy notice.
- Prohibit unverifiable rankings and comparative 'best', success-rate claims, outcome guarantees, purchased 'verified' badges and undisclosed paid placement.
- Advertising and remuneration policy review by Nigerian-qualified legal counsel (RPC 2023; LPRO 2023 and changes).
- No per-case percentage referral model pending robust legal opinion. Prefer fixed SaaS subscription for professional tools; any advertising revenue must be ethical and transparently disclosed.

## Public-to-lawyer intake (future, NOT active)
Search → profile review → urgent or ordinary issue classification → lawyer enquiry (minimum necessary data) → lawyer verifies jurisdiction/competence/availability → conflicts gate → quote and transparent written scope → engagement accepted → secure intake → matter timeline → outcome feedback. Never imply a relationship before accepted engagement.

## Pillar 1: police-station support
- Accessible urgent intake with explicit privacy notice; collect only needed information and obtain lawful authority.
- Distinguish unverified family report from verified custody; status must not be described as 'lawyer assigned' until a qualified lawyer accepts.
- Prioritise human review, safety, location checks, referral to legal aid as appropriate.
- No promise of release and no bail-negotiation fees. Police bail is free. Lawful professional fees and reimbursable expenses separately identified.
- State ACJL differences; ACJA context may not be a universal substitute.
- Every action time-stamped, attributed to an authenticated actor and independently auditable.
- Do not automatically generate or send a rights petition without lawyer review.

## Pillar 2: matter/court management
- Matter timeline with statuses as lawyer-generated reports, not official court record.
- OCR/cause-list parsing is **suggestion only**, requires human verification against court document and jurisdiction. Retain source document and verification record.
- Hearing reminders only after confirmed dates; channel opt-in for SMS/WhatsApp; recipient selection and confidentiality safeguards.
- Evidence vault needs tenant isolation, encryption, least privilege, retention schedule, legal holds and immutable audit trail.
- Court integrations only through formal available APIs/agreements; do not claim nationwide live sync.

## Pillar 3: client portal and documents
- Guided questionnaire, approved templates per jurisdiction, revision history, citations and approvals.
- Draft → factual validation → applicable-law check → partner/qualified lawyer approval → client delivery.
- Mark AI output as unverified, forbid auto-submission and block privileged data to consumer AI.
- For CAC, do not claim filing until actual official confirmation received; check official prerequisites and current fees.
- Accessible mobile-first client update timeline and download/export feature.

## Pillar 4: marketplace and incubator
- Self-serve profile preparation and practice positioning for graduates; public status blocked until lawyer credentials independently verified.
- Peer-mentor matching only where ethics, confidentiality and consent permit.
- Billing for SaaS should be separate from collection of professional fees. Payment escrow is NOT available merely because a PSP has transfer or split settlement.
- Complaints route, human review and appeal; reasonable neutral search ordering.

## Architecture for production
Frontends: progressive web app (client/public + professional portals) using accessible responsive UI. API: versioned backend, Node/TypeScript or .NET, deployed in approved region with WAF and rate limiting. IAM: OAuth/OIDC, MFA for lawyers, RBAC/ABAC, firm and matter tenant isolation. Data: Postgres with row level security, encrypted object storage for evidence, background jobs for consented notifications, secrets vault, SIEM audit logs. Search: scoped indexes containing no privileged case facts. AI: retrieval from licensed and checked legal sources, provenance/versions, strict non-advice boundaries, lawyer-sign-off and evaluation. Payments: only after banking/PSP/legal advice; do not label split payments 'escrow'. Integrations: CAC and courts only where authorised; notification providers only with opt-in and minimisation. Backup and disaster recovery. DPIA, NDPA 2023 controls, breach and DSAR procedures.

## Main entities (minimal)
users(id, role, contact, consent); lawyer_profiles(id,user_id,verification_status,roll_ref_internal,areas,locations,languages); firms(id,org_status); memberships(user_id,firm_id,role); clients(id,firm_id,contact_ciphertext); enquiries(id,client_id,lawyer_id,conflict_status,urgency); engagements(id,enquiry_id,scope,fees_reviewed,accepted_at); matters(id,firm_id,engagement_id,jurisdiction,status); events(id,matter_id,actor_id,stage,timestamp,verified_by); documents(id,matter_id,storage_key,classification,revision,approved_by); access_logs(id,actor_id,resource,operation,time); payment_records(id,engagement_id,provider_ref,classification); subscriptions(id,firm_id,plan,status); reports(id,subject,category,state,reviewer,outcome). No lawyer directory data or payment credentials should be fabricated.

## User experience details
- Public: mobile first, English with later Nigerian-language translation professionally reviewed.
- Urgent intake: show prominent 'not emergency dispatch' status unless real staffed service has passed acceptance tests.
- Track progress with known verified milestones; do not expose protected police/court data to unverified family contacts.
- Preserve local-copy options, consented communication and granular disclosure.
- Display verified dates, source and caveat when describing current law.

## Release phases
0. This synthetic frontend and research.
1. Independent Nigerian legal opinion + stakeholder discovery with lawyers, clients, NBA representatives and legal-aid organisations; standards, DPIA and fee framework.
2. Production marketplace, lawyer verification and practice subscriptions for limited pilot geographies, e.g. Lagos and FCT; no criminal dispatch or payment escrow.
3. Secure client portal, lawyer-approved document workflows and matter updates; audit and security testing.
4. Controlled police-station pilot with trained, credentialled duty counsel and humane support model; court data OCR with manual sign-off.
5. Expand verification and operations across all states and FCT as actual supply and compliance capacity permit.

## KPIs (hypotheses, not claims)
Verified practitioners by jurisdiction; confirmed first response time; enquiry-to-engagement conversion; share of matters with client updates; verified document rejection/defect rate; missed-date rate; complaint rate; satisfaction and accessibility measures. No fabricated '80% reduction' or financial projections.

## Compliance prerequisites for launch
Nigerian lawyer review of RPC and advertising, LPRO, possible fee-sharing/intermediary issues, data protection and confidentiality, police bail and state criminal-procedure law; business entity and legal-services boundaries; consumer protection, payment-provider authority, consent for messages, cross-border processing, cyber controls, accessibility. Professional bodies or official sources should verify licence/standing via an agreed protocol.

## Research / official resources
HiiL Justice Needs and Satisfaction Nigeria: https://hiil.org/research/justice-needs-and-satisfaction-in-nigeria/
Nigerian Bar Association: https://www.nigerianbar.org.ng/
Nigeria Data Protection Commission: https://ndpc.gov.ng/
Nigeria Legal Aid Council: https://legalaidcouncil.gov.ng/
Nigeria Police Force: https://www.npf.gov.ng/
Nigerian Corporate Affairs Commission: https://www.cac.gov.ng/
Nigeria's laws and professional rules must be verified in their latest authoritative versions at launch. This document is product-planning research, not a legal opinion.
