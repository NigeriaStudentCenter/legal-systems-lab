# LexFlow CPD — Azure infrastructure verification procedure

**Status:** Infrastructure reported deployed in [DEV-DEPLOYMENT.md](DEV-DEPLOYMENT.md), last recorded 16 Nov 2026. This document distinguishes **code/repository evidence** from **live Azure evidence**. Nothing here changes Azure resources.

## Run read-only Azure audit

From a machine with Azure CLI and the correct subscription selected:

```bash
az login
az account set --subscription "<BSOE SUBSCRIPTION ID>"
bash lexflow-cpd/infra/verify-azure-readonly.sh
```

The script inspects the resource group and Container App without printing application environment variables, Key Vault secret values, API access tokens, database URLs or credentials. It checks public HTTPS /healthz and /readyz.

Expected development inventory from the existing deployment record:
- resource group `rg-lexflow-cpd-dev`
- Container App `lexflowcpd-api`, port 8080, scale-to-zero
- user-assigned identity `lexflowcpd-api-id`
- PostgreSQL database `lexflow_cpd` on a separately managed shared server
- shared staging environment, log workspace and Key Vault

**Readiness is only a DB-availability/schema check, not evidence that business flows or accreditation are valid.**

## Evidence gates

| Gate | Acceptable evidence |
| --- | --- |
| Azure resource group | Azure CLI resource JSON showing correct subscription and location |
| Container build/revision | running revision digest matches approved tested GitHub image digest |
| Health | /healthz = 200, /readyz = 200, restart behaviour observed |
| Database | Privileged operator's migration log; restricted-login privilege audit; backups tested |
| Entra | Browser sign-in + token issuer/audience validation using **fictional** learner; API denies wrong-role and unauthorised accounts |
| Attendance | server-side enrolment, pending faculty attestations and separately reviewed evidence; no credit on self-checkin |
| Certificate | approved completion evidence; authenticated issuer, verifiable reference and revocation test |
| AI tutor | managed-identity model call, budget/quotas, privacy policy, prompt injection and hallucination tests |
| NBA-ICLE | written provider/course accreditation, approved credit allocation and regulator-confirmed submission channel |

Do not include secret-bearing screenshots, `az containerapp show --query properties.template.containers[0].env`, Key Vault values, participant data or signed tokens in GitHub issue reports.

## Deployment decisions

Keep the current **dev** environment fictional-data-only. No production enrolments, certificates or regulator submissions until audited security controls, privacy assessment and formal approvals exist. Before a new release, confirm the corresponding GitHub CI integration tests pass and approve the immutable container-image digest. CI builds images but does not itself update the Container App; deployment is an operator-controlled action.

## Outstanding operational dependencies

1. Live Azure resource access and Azure CLI audit.
2. Version-controlled release/deployment confirmation against the latest source revision.
3. Azure OpenAI provisioning, AI permissions and cost controls (currently off).
4. Independent faculty attendance/assessment approval and certificate issuance/revocation.
5. NBA-ICLE reporting specification and written accreditation; never imply credits are authorised without them.
