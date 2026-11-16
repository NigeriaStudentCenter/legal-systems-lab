# LexFlow CPD Phase 8 — verified image release candidate

**Build and tests:** GitHub Actions run [43833237206](https://github.com/NigeriaStudentCenter/legal-systems-lab/actions/runs/43833237206) completed successfully on 16 November 2026.
**Source SHA:** `26b8b2dedc6b14e981967a8dc2efcc2e04c37132`.
**Published immutable image:**
```text
ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:33243849a23cd1e36cf425e1c8f9aad15568338d84dc3e9967cdcdb8570a8f90
```

This image is a **release candidate**, not proof of Azure deployment. Do not change `infra/dev.parameters.json` until an authorised operator completes all prerequisites. In particular, the current parameter-file image is the older digest `sha256:e256637fe434734634c1c692a8b36c470f80db6a1fb606f35e3f3eea41f5f17f`.

## Operator sequence

1. In Azure, verify subscription and resource group `rg-lexflow-cpd-dev` and Container App `lexflowcpd-api`. Confirm the current revision and preserve its image digest for rollback.
2. Confirm PostgreSQL backups and migrations 001/002. Apply `backend/sql/003_capstone_assessment.sql` using a **privileged migration login**, not the runtime identity. Grant only SELECT/INSERT/UPDATE on the two new tables to `lexflow_cpd_runtime`.
3. Execute read-only `infra/check-phase8-runtime-grants.sql` using the actual runtime identity, resolving every failed check before proceeding.
4. Run `infra/release-phase8.sh` in default preview mode using the approved image and your verified subscription ID. Review the **full** what-if resource differences, including Key Vault, managed identity and AI resources; stop for unexpected changes.
5. Only an authorised operator should set the explicit deployment gates to YES after confirming database migration, permission audit, CI success, what-if review and release approval. The deploy script is deliberately fail-closed.
6. Confirm `/healthz` and `/readyz` return HTTP 200, `/api/capstone/my` without a token returns HTTP 401, the active image matches this release candidate, and fictional learner/faculty scenarios succeed.
7. No real learner/client records and **no NBA-ICLE credits** in this development environment.

## Copy/paste: safe preview (does not deploy)

```bash
export APPROVED_IMAGE='ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:33243849a23cd1e36cf425e1c8f9aad15568338d84dc3e9967cdcdb8570a8f90'
export EXPECTED_SUBSCRIPTION_ID='<your actual Azure subscription UUID>'
bash lexflow-cpd/infra/release-phase8.sh
```

## Copy/paste: authorised deployment only after checks

```bash
APPLY_PHASE8=YES \
MIGRATION_003_CONFIRMED=YES \
DB_RUNTIME_GRANTS_AUDITED=YES \
GITHUB_TESTS_PASSED=YES \
WHAT_IF_REVIEWED=YES \
RELEASE_APPROVAL=YES \
bash lexflow-cpd/infra/release-phase8.sh
```

The second command uses the environment variables from the preview command and **will deploy to Azure** if all attestations are provided. Do not use it until an authorised operator has completed and approved each step.

**Not done by this release record:** direct Azure account access, migration 003, Azure deployment, or live learner/faculty acceptance tests. `auth-config.js` remains unchanged.
