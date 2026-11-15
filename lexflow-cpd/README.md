# LexFlow CPD Academy — public pilot

This is the distinct CPD learning section within the legal-systems-lab GitHub Pages site. Navigate to `/lexflow-cpd/`.

## Included
- Responsive public course directory
- Five written learning modules and fictional Nigerian legal practice scenarios
- Interactive four-step citation verification walkthrough
- Browser-local workbook and downloadable JSON study record
- Eight-question automatically marked educational knowledge check
- Compliance, privacy and secure-backend architecture overview

## Status and limitations
- NBA-ICLE provider approval: NOT established; individual-course approval: NOT established. Awarded NBA CPD points: ZERO.
- A HeyGen animated educational clip has been submitted separately; no permanent playback URL or downloadable MP4 was available when this public pilot was committed. Never substitute a temporary signed generation URL for permanent hosting.
- Azure AI tutor: NOT connected to an Azure tenant.
- Authenticated learner management: NOT enabled.
- Actual NBA-ICLE reporting API: NOT established. The public site sends no regulator records. Authorised private CSV/XLSX exports will require an approved data model and written regulator instructions.
- Local workbook answers are not verified participation and must never be treated as regulator submissions.

## Azure implementation checklist
1. Provision Azure subscription/resource group; review residency, pricing and organisational access.
2. Set up Entra External ID and sign-in flows (learner, instructor, admin), mandate MFA for privileged accounts.
3. Deploy protected Azure Functions/App Service API with server-side identity validation, application-level RBAC and a managed identity.
4. Provision Cosmos DB or Azure SQL with restricted networking, encryption, audit logs, backup and documented NDPA retention policy.
5. Configure Azure OpenAI/Foundry model deployment; model secrets or endpoints must never live in public source. Restrict to fictional/anonymised learner questions.
6. Implement server-side assessment submission, active session attendance, faculty sign-off, evidence audit and regulator-approved credits after formal approval.
7. Implement enrollment export before each approved event and participation export afterward according to NBA-ICLE guidance; inspect records before sending.
8. Test threat model, cost controls, role permissions, deletion workflows and faculty review before live enrolment.

This repository is a public **educational pilot**, not a secure backend or regulator-certified portal.
