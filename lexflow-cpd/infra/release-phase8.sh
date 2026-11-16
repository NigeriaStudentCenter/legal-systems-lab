#!/usr/bin/env bash
# Phase 8 controlled Azure Container Apps deployment.
# Default: Azure Resource Manager WHAT-IF only. NO deployment or migration by default.
# Usage:
#   APPROVED_IMAGE=ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:<64 hex> \
#   EXPECTED_SUBSCRIPTION_ID=<uuid> bash lexflow-cpd/infra/release-phase8.sh
# To apply, in addition set:
#   APPLY_PHASE8=YES MIGRATION_003_CONFIRMED=YES DB_RUNTIME_GRANTS_AUDITED=YES \
#   GITHUB_TESTS_PASSED=YES WHAT_IF_REVIEWED=YES RELEASE_APPROVAL=YES
# No secrets, connection strings, login tokens or identity credentials are printed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="${LEXFLOW_RESOURCE_GROUP:-rg-lexflow-cpd-dev}"
APP="${LEXFLOW_CONTAINER_APP:-lexflowcpd-api}"
IMAGE="${APPROVED_IMAGE:-}"
SUBSCRIPTION="${EXPECTED_SUBSCRIPTION_ID:-}"
PARAMETERS="$ROOT/dev.parameters.json"
TEMPLATE="$ROOT/dev.bicep"
if ! command -v az >/dev/null; then echo "Azure CLI missing" >&2; exit 2; fi
if [[ ! "$IMAGE" =~ ^ghcr\.io/nigeriastudentcenter/lexflow-cpd-api@sha256:[a-f0-9]{64}$ ]]; then
  echo "APPROVED_IMAGE must be a complete, immutable GHCR image digest (64 hex characters)" >&2; exit 2
fi
if [[ ! "$SUBSCRIPTION" =~ ^[a-fA-F0-9-]{36}$ ]]; then
  echo "EXPECTED_SUBSCRIPTION_ID must be the intended Azure subscription UUID" >&2; exit 2
fi
CURRENT_SUB="$(az account show --query id -o tsv)"
if [[ "${CURRENT_SUB,,}" != "${SUBSCRIPTION,,}" ]]; then
  echo "STOP: selected subscription differs from EXPECTED_SUBSCRIPTION_ID" >&2; exit 3
fi
echo "Subscription confirmed: $CURRENT_SUB"
echo "Target: $RG / $APP"
echo "Approved image: $IMAGE"
az group show -n "$RG" --query '{name:name,location:location,state:properties.provisioningState}' -o json >/dev/null
ORIGINAL="$(az containerapp show -g "$RG" -n "$APP" --query properties.template.containers[0].image -o tsv)"
echo "Current image: $ORIGINAL"
echo "Checking proposed changes with Azure Resource Manager (read-only what-if)."
echo "Review ALL listed resource changes, including identity and Key Vault scopes; the deployment template may update more than the API image."
az deployment group what-if \
  --resource-group "$RG" \
  --template-file "$TEMPLATE" \
  --parameters "@$PARAMETERS" image="$IMAGE" \
  --result-format FullResourcePayloads
if [[ "${APPLY_PHASE8:-NO}" != "YES" ]]; then
  echo "WHAT-IF COMPLETE. No deployment performed. Set APPLY_PHASE8=YES with all safeguards to apply."
  exit 0
fi
for name in MIGRATION_003_CONFIRMED DB_RUNTIME_GRANTS_AUDITED GITHUB_TESTS_PASSED WHAT_IF_REVIEWED RELEASE_APPROVAL; do
  if [[ "${!name:-}" != "YES" ]]; then
    echo "STOP: $name=YES must be explicitly attested by an authorised operator" >&2
    exit 3
  fi
done
if [[ "$IMAGE" == "$ORIGINAL" ]]; then
  echo "Approved image already selected in Azure; no new revision is required."
else
  echo "Operator-attested Azure Bicep deployment with immutable digest and reviewed resource diff..."
  az deployment group create \
    --resource-group "$RG" \
    --template-file "$TEMPLATE" \
    --parameters "@$PARAMETERS" image="$IMAGE" \
    --name "lexflow-cpd-phase8-$(date -u +%Y%m%d%H%M%S)" \
    --only-show-errors \
    --query '{name:name,state:properties.provisioningState}' -o json
fi
echo "Performing read-only verification of target image and API endpoints..."
EXPECTED_IMAGE="$IMAGE" LEXFLOW_RESOURCE_GROUP="$RG" LEXFLOW_CONTAINER_APP="$APP" \
  bash "$ROOT/check-phase8-azure.sh"
echo "Phase 8 infrastructure checks passed; human role-specific fictional acceptance testing remains required."
echo "If rollback is needed, retain the previous digest privately in the release record and re-run"
echo "the same reviewed process with APPROVED_IMAGE set to that previously approved digest."
