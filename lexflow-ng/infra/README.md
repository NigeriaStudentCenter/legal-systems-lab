# LexFlow NG Azure staging infrastructure — deployment deliberately gated

**Nothing in this folder has been deployed to an Azure subscription.** The templates prepare a future staging environment without enabling external lawyer registrations, privileged documents or public API traffic. Azure subscription and billing, region, identity, privacy, security reviews, and personnel approval are required.

## Contents
- `bootstrap.bicep`: proposed staging network, private PostgreSQL Flexible Server with private DNS, Key Vault with RBAC, Container Registry, and monitoring workspace.
- `containerapp.bicep`: later private Container Apps environment and the API container with **no public ingress** and all business feature flags disabled.
- `../../.github/workflows/lexflow-infra-check.yml`: Bicep syntax validation only.
- `../../.github/workflows/lexflow-azure-staging.yml`: guarded manual deployment workflow using GitHub OIDC and an approved Azure identity (disabled until `LEXFLOW_AZURE_DEPLOY_ENABLED=true` is explicitly set by repo admin).

## Deployment prerequisites
1. Obtain Nigerian legal, professional, data protection and security reviews; define lawful hosting geography and data flows.
2. Agree Azure subscription, resource group, billing budget, region, network plan, role assignments, operational access and incident responsibility.
3. Configure GitHub OIDC federation on a narrowly scoped Azure deployment identity. Never paste Azure client secrets, database passwords or JWTs into GitHub.
4. Apply `bootstrap.bicep` in a staging resource group only after technical review and cost estimate. The PostgreSQL administrator password must be passed from protected secret storage, NOT committed in parameter files.
5. Create and test a non-admin DB login for runtime use, ensure TLS and private connectivity; run SQL migrations with a separate temporary migration identity.
6. Build an approved image from backend/Dockerfile, scan and pin by immutable digest, publish to private registry and separately grant pull to managed identity.
7. Configure trusted OIDC issuer, audience and JWKS URI, Key Vault secret references and private Container Apps network; run tests with synthetic data.
8. Only after operational sign-off, configure Front Door Premium / Private Link ingress with a reviewed origin policy, WAF and DDoS controls.
9. Test actual sign-up, identity lifecycle, review dual control and expiry/suspension; release flags remain off by default.

**Do not** allow a public endpoint while relying on placeholder login, registry image, or sample values. These are blueprints for review, not an Azure deployment confirmation.

## Official references
https://learn.microsoft.com/en-us/azure/container-apps/
https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-networking-private
https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect
https://learn.microsoft.com/en-us/entra/external-id/customers/
