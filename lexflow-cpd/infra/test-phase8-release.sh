#!/usr/bin/env bash
# No Azure access, network or secrets. Verify Phase 8's default is WHAT-IF ONLY
# and APPLY cannot proceed unless every explicit operator gate is supplied.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat > "$TMP/bin/az" <<'MOCK'
#!/usr/bin/env bash
echo "$*" >> "$MOCK_LOG"
case "$*" in
  "account show --query id -o tsv") echo "11111111-1111-4111-8111-111111111111";;
  *"containerapp show"*"-o tsv"*) echo "ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";;
  *) :;;
esac
MOCK
chmod +x "$TMP/bin/az"
export MOCK_LOG="$TMP/az-calls.txt"
export PATH="$TMP/bin:$PATH"
export APPROVED_IMAGE="ghcr.io/nigeriastudentcenter/lexflow-cpd-api@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
export EXPECTED_SUBSCRIPTION_ID="11111111-1111-4111-8111-111111111111"
bash "$HERE/release-phase8.sh" > "$TMP/dryrun.txt"
grep -q "WHAT-IF COMPLETE. No deployment performed" "$TMP/dryrun.txt"
grep -q 'deployment group what-if' "$MOCK_LOG"
if grep -q 'deployment group create' "$MOCK_LOG"; then echo "ERROR: deployed without explicit approval" >&2; exit 1; fi
: > "$MOCK_LOG"
if APPLY_PHASE8=YES bash "$HERE/release-phase8.sh" > "$TMP/unapproved.txt" 2>&1; then
  echo "ERROR: APPLY_PHASE8 succeeded despite missing attestations" >&2
  exit 1
fi
grep -q 'MIGRATION_003_CONFIRMED=YES' "$TMP/unapproved.txt"
if grep -q 'deployment group create' "$MOCK_LOG"; then echo "ERROR: unapproved image was deployed" >&2; exit 1; fi
: > "$MOCK_LOG"
if EXPECTED_SUBSCRIPTION_ID="22222222-2222-4222-8222-222222222222" bash "$HERE/release-phase8.sh" > "$TMP/badsub.txt" 2>&1; then
  echo "ERROR: wrong-subscription release was allowed" >&2; exit 1
fi
if grep -q 'deployment group what-if\|deployment group create' "$MOCK_LOG"; then
  echo "ERROR: wrong subscription reached resource deployment commands" >&2; exit 1
fi
echo "PASS: default is read-only, approvals are mandatory, wrong subscription is blocked."
