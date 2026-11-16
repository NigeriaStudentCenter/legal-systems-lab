#!/usr/bin/env bash
# Read-only LexFlow CPD Azure inventory. Does not deploy or change resources.
set -euo pipefail
RG="${LEXFLOW_RESOURCE_GROUP:-rg-lexflow-cpd-dev}"
APP="${LEXFLOW_CONTAINER_APP:-lexflowcpd-api}"
echo "== LexFlow CPD Azure read-only audit =="
command -v az >/dev/null || { echo "Azure CLI (az) missing" >&2; exit 2; }
az account show --query '{subscription:name, subscriptionId:id, tenantId:tenantId}' -o json
echo "== Resource group =="
az group show --name "$RG" --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
echo "== Development resources (names/types only) =="
az resource list --resource-group "$RG" --query '[].{name:name,type:type,location:location}' -o table
echo "== Container App provisioning and runtime (no secrets) =="
az containerapp show --resource-group "$RG" --name "$APP" --query '{
 name:name,
 state:properties.provisioningState,
 fqdn:properties.configuration.ingress.fqdn,
 external:properties.configuration.ingress.external,
 targetPort:properties.configuration.ingress.targetPort,
 image:properties.template.containers[0].image,
 minReplicas:properties.template.scale.minReplicas,
 maxReplicas:properties.template.scale.maxReplicas,
 latestRevision:properties.latestRevisionName,
 runningRevision:properties.latestReadyRevisionName
}' -o json
echo "== Liveness/readiness HTTP endpoints =="
FQDN="$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)"
if [[ -n "$FQDN" ]]; then
  for endpoint in healthz readyz; do
    code="$(curl --max-time 25 -sS -o /dev/null -w '%{http_code}' "https://$FQDN/$endpoint" || true)"
    echo "/$endpoint: HTTP $code"
  done
fi
echo "== Limits of this audit =="
echo "Database table permissions, successful learner identity tests, Key Vault secret contents,"
echo "Entra External tenant, AI deployment, NBA accreditation and actual certificate issuance"
echo "are NOT attested by this Azure control-plane check."
