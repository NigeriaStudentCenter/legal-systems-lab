# Annex A — Institutional Profile and Governance Capacity

**Applicant identity — verification pending**
- **Educational operating identity:** British School of Outdoor Education (BSOE).
- **Platform identity:** LexFlow CPD Academy – Nigeria.
- **Statutory applicant:** Earlier CAC document transcription: **BRITISH SCHOOLS OF OUT-DOOR EDUCATION LTD**; public search reportedly displayed **BRITISH SCHOOLS PF OUT-DOOR EDUCATION LTD**. Resolve exact registered name against CAC original and current extract before signing or paying.
- **RC:** 1064369 (previously transcribed; confirm).
- **Reported incorporation:** 11 September 2012 (confirm against original).
- **Entity form:** Company limited by shares (prior review; reconfirm).
- **Current CAC status:** Earlier search returned **INACTIVE**. Obtain up-to-date status and legal advice on regularisation/eligibility. Do not claim active compliance without evidence.
- **Education objects:** Earlier review indicated objects encompassing education, training, seminars, workshops, tutorials and certificates. Verify precise object text from authenticated MEMART.
- **Registered office / Nigeria teaching office / contact:** [REQUIRES DOCUMENTS].
- **Directors, officers, beneficial-owner disclosures, signatory mandate:** [PRIVATE DOCUMENTS — secure annex].
- **Tax and business-compliance evidence:** [REQUIRES VERIFICATION].

## Institutional purpose
BSOE seeks to expand structured continuing professional learning for Nigerian legal practitioners. LexFlow CPD Academy is designed to make law-relevant AI literacy practical: practitioners learn to check citations, verify amendments and effective dates, identify unsupported generated contract terms, preserve client confidentiality, assess supplier terms and establish a human-controlled workflow.

This profile does not claim BSOE is a university, NBA-ICLE provider, law society, regulator, or awarder of recognised statutory professional credit.

## Programme architecture
- **Flagship:** Responsible AI for Nigerian Legal Practice; five modules, twenty structured lessons; 440 minutes of planned lesson activity plus independent and faculty activity, subject to academic review. **440 planned minutes are not 440 verified minutes nor automatically 7.33 CPD credits.**
- **Learning assets:** written explanations; five original fictional legal evidence packs; 25 guided investigation stages; five decision simulations; 20 knowledge checks; local workbooks; downloadable capstone.
- **Instructor delivery:** five proposed 120-minute facilitated workshops, each mapped to one module; faculty handbook and marking guidance.
- **AI learning support:** Azure AI tutor uses a bounded server-controlled lesson/case context, Microsoft Entra roles and educational privacy controls; it cannot mark legal facts authoritative.
- **Media:** as of 16 November 2026, **one of five HeyGen original teaching videos completed**, and the other four reported failed because generation credits were exhausted. Do not represent the video series as complete.
- **Assessment:** proposed six-part 100-point capstone with faculty scoring, separate from self-study knowledge checks and formal BSOE certificate eligibility.
- **Certificates:** BSOE educational completion is a separate award. NBA-ICLE CPD credit/recognition = **zero until written approval**.

## Technology and assurance evidence
The version-controlled development deployment record documents:
- dedicated Azure resource group `rg-lexflow-cpd-dev`, Container App `lexflowcpd-api`, PostgreSQL `lexflow_cpd` on a shared server, secret in a shared staging Key Vault, managed identity, Entra External ID (staging tenant);
- operator-run migrations 001, 002 and 003, restricted runtime SELECT/INSERT/UPDATE, no DDL/DELETE, API authentication and faculty role controls;
- 26/26 fictional Phase 8 API checks, including capstone submission, assigned-faculty marking, result readback and no automatic certificate eligibility.
See `../infra/DEV-DEPLOYMENT.md`. These are historical documented tests, not an independent current production-security audit. **No actual participant identity, privilege, client papers or professional regulator returns should enter this shared development environment**.

## Proposed organisational governance (appointments pending)
| Role | Accountable duties | Named appointee / proof |
|---|---|---|
| Responsible institutional officer | Board application, regulatory correspondence, inspection, approvals | [NAME + mandate pending] |
| Nigerian legal course director | Source accuracy, professional ethics, content approval and legal faculty supervision | [Nigeria-qualified lawyer + bar credentials pending] |
| Lead faculty and independent assessor | Course delivery, written materials, marking, moderation, feedback | [CV, call-to-bar, current evidence pending] |
| Data protection lead | NDPA/GAID application, retention, processing records, notices, incidents | [named lead + legal review pending] |
| Azure platform owner | Authentication, logs, cyber security, backups, permissions, incident response | [named internal technical owner pending] |
| Quality and learner-access officer | Accessibility, complaints, hardship applications, attendance reconciliation | [named officer pending] |

## Production commitments and constraints
Prior to actual participant enrolment: production-separated identity and database, secure reporting process, privacy notice and legal processing basis, retention and deletion schedule, accessible media and course alternatives, faculty accreditation/competency file, approved session records, disaster recovery, complaints/appeals policy, current fees and duly approved activity schedules.

## Evidence pointers
- Course curriculum: `../academy-content.js`
- Practice cases: `../case-dossiers.js`
- Guided exercises: `../guided-investigations-content.js`
- Instructor handbook: `../INSTRUCTOR-DELIVERY-PACK.md`
- Assessment policy/source: `../capstone-content.js` and `../backend/capstone-policy.mjs`
- Internal quality findings: `../PHASE12-QA-REVIEW-DOSSIER.md`
- Video tracker: `../VIDEO-PRODUCTION-TRACKER.md`
- Azure fictional environment: `../infra/DEV-DEPLOYMENT.md`

**Private supporting annexes:** CAC certified/status documents, director mandate, faculty CVs/practising fee receipts/credentials, bank/fee statements, cyber and privacy documentation, real learner templates. These must not be stored in public GitHub.
