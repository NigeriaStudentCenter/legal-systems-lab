#!/usr/bin/env bash
# Read-only preflight for a proposed LexFlow CPD Azure Container Apps image.
# Never makes ARM changes, applies SQL, reads secrets, or prints DATABASE_URL.
set -euo pipefail
RG="${LEXFLOW_RESOURCE_GROUP:-rg-lexflow-cpd-dev}"
APP="${LEXFLOW_CONTAINER_APP:-lexflowcpd-api}"
EXPECTED_IMAGE="${EXPECTED_IMAGE:-}"
FAIL=0
if ! command -v az >/dev/null 2>&1; then echo "ERROR: Azure CLI is required" >&2; exit 2; fi
echo "LexFlow CPD — read-only Azure release preflight"
echo "Selected subscription and tenant:"
az account show --query '{name:name,subscriptionId:id,tenantId:tenantId}' -o json
echo "Resource group:"
az group show -n "$RG" --query '{name:name,location:location,state:properties.provisioningState}' -o json
echo "Container App details (no environment variables, no secrets):"
az containerapp show -n "$APP" -g "$RG" --query '{
 name:name,
 state:properties.provisioningState,
 ingressExternal:properties.configuration.ingress.external,
 ingressPort:properties.configuration.ingress.targetPort,
 latestRevision:properties.latestRevisionName,
 latestReadyRevision:properties.latestReadyRevisionName,
 image:properties.template.containers[0].image,
 identity:identity.type
}' -o json
CURRENT_IMAGE="$(az containerapp show -n "$APP" -g "$RG" --query 'properties.template.containers[0].image' -o tsv)"
FQDN="$(az containerapp show -n "$APP" -g "$RG" --query 'properties.configuration.ingress.fqdn' -o tsv)"
PORT="$(az containerapp show -n "$APP" -g "$RG" --query 'properties.configuration.ingress.targetPort' -o tsv)"
if [[ "$PORT" != "8080" ]]; then echo "FAIL: Container App ingress port must be 8080 (found $PORT)"; FAIL=1; fi
if [[ "$CURRENT_IMAGE" != *"@sha256:"* ]]; then echo "FAIL: Current image is not pinned by immutable SHA-256 digest"; FAIL=1; fi
if [[ -n "$EXPECTED_IMAGE" ]]; then
  if [[ "$EXPECTED_IMAGE" != ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:* ]]; then
    echo "FAIL: EXPECTED_IMAGE must be the approved LexFlow GHCR immutable digest"; FAIL=1
  elif [[ "$CURRENT_IMAGE" == "$EXPECTED_IMAGE" ]]; then
    echo "PASS: Azure is running the requested approved image"
  else
    echo "NOT YET DEPLOYED: Azure image differs from approved target; no changes made"
    echo "Current: $CURRENT_IMAGE"
    echo "Target : $EXPECTED_IMAGE"
  fi
else
  echo "NOTICE: EXPECTED_IMAGE not supplied; cannot establish if Azure runs the new source"
fi
if [[ -z "$FQDN" ]]; then echo "FAIL: No public FQDN detected"; FAIL=1
else
  for endpoint in healthz readyz; do
    CODE="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 --max-time 30 "https://$FQDN/$endpoint" || true)"
    echo "GET /$endpoint => HTTP $CODE"
    if [[ "$CODE" != "200" ]]; then FAIL=1; fi
  done
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 --max-time 30 "https://$FQDN/api/capstone/my" || true)"
  echo "GET /api/capstone/my unauthenticated => HTTP $CODE"
  if [[ "$CODE" != "401" ]]; then FAIL=1; fi
fi
echo "LIMITATION: This script does not authenticate to PostgreSQL, verify migration 003,"
echo "check a new GitHub build result, exercise role-specific user flows, or approve CPD credits."
if [[ "$FAIL" -ne 0 ]]; then echo "Preflight failed one or more checks" >&2; exit 1; fi
echo "Read-only API and Container App preflight passed; further release gates still apply."
