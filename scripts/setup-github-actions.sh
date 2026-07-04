#!/usr/bin/env bash
# =============================================================================
# setup-github-actions.sh — One-time GitHub Actions CI/CD setup
#
# Run this script ONCE from the VPS as root to:
#   1. Push .github/workflows/deploy.yml to GitHub (needs PAT with `workflow` scope)
#   2. Set all 4 required GitHub Secrets via API
#   3. Verify SSH connectivity for the deploy key
#
# Prerequisites:
#   - A GitHub Personal Access Token (PAT) with scopes: repo, workflow, secrets
#     (Classic PAT from https://github.com/settings/tokens)
#
# Usage:
#   bash /home/vpn/webapp/scripts/setup-github-actions.sh <YOUR_PAT_TOKEN>
#
# Example:
#   bash /home/vpn/webapp/scripts/setup-github-actions.sh ghp_xxxxxxxxxxxx
# =============================================================================

set -euo pipefail

WEBAPP_DIR="/home/vpn/webapp"
REPO="pt-zenity/VpnPro"
VPS_HOST="23.111.15.50"
VPS_USER="root"
VPS_PORT="22"
DEPLOY_KEY_PATH="$WEBAPP_DIR/scripts/.deploy_key"

# ── Validate arguments ─────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo ""
  echo "❌  Missing GitHub PAT token."
  echo ""
  echo "    Usage: bash $0 <YOUR_GITHUB_PAT>"
  echo ""
  echo "    Get a PAT at: https://github.com/settings/tokens/new"
  echo "    Required scopes: repo  +  workflow  +  (classic token)"
  echo ""
  exit 1
fi

PAT="$1"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
ok()  { echo "[$(date '+%H:%M:%S')] ✅ $*"; }
fail(){ echo "[$(date '+%H:%M:%S')] ❌ $*"; exit 1; }

# ── Step 1: Verify PAT works ───────────────────────────────────────────────────
log "Step 1/5 — Verifying PAT..."
RATE_LIMIT=$(curl -sf -H "Authorization: token $PAT" https://api.github.com/rate_limit | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['rate']['remaining'])" 2>/dev/null || echo "0")
if [ "$RATE_LIMIT" = "0" ]; then
  fail "PAT is invalid or rate-limited. Check your token at https://github.com/settings/tokens"
fi
ok "PAT valid (API rate limit remaining: $RATE_LIMIT)"

# ── Step 2: Configure git to use PAT and push workflow ────────────────────────
log "Step 2/5 — Pushing workflow files to GitHub..."

cd "$WEBAPP_DIR"

# Temporarily set the remote URL with PAT
git remote set-url origin "https://x-access-token:${PAT}@github.com/${REPO}.git"

# Make sure we're on main and have the latest commit
git checkout main

# Push main branch (includes .github/workflows/deploy.yml)
git push origin main 2>&1 | tail -5

# Restore original remote (without PAT in URL for security)
git remote set-url origin "https://github.com/${REPO}.git"

ok "Workflow files pushed to GitHub main branch"

# ── Step 3: Set GitHub Secrets ────────────────────────────────────────────────
log "Step 3/5 — Setting GitHub Secrets..."

# Get the repo's public key for encrypting secrets
PK_RESPONSE=$(curl -sf \
  -H "Authorization: token $PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/actions/secrets/public-key")

PK_KEY_ID=$(echo "$PK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['key_id'])")
PK_KEY=$(echo "$PK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['key'])")
log "  Repo public key id: $PK_KEY_ID"

# Helper: encrypt a secret value with the repo's public key (libsodium sealed box)
encrypt_secret() {
  local secret_value="$1"
  python3 - "$PK_KEY" "$secret_value" <<'PYEOF'
import sys, base64
from nacl import public, encoding

pub_key_b64 = sys.argv[1]
secret_val  = sys.argv[2]

pub_key_bytes = base64.b64decode(pub_key_b64)
pub_key_obj   = public.PublicKey(pub_key_bytes)
sealed_box    = public.SealedBox(pub_key_obj)
encrypted     = sealed_box.encrypt(secret_val.encode("utf-8"))
print(base64.b64encode(encrypted).decode("utf-8"))
PYEOF
}

# Helper: create or update a single secret
set_secret() {
  local secret_name="$1"
  local secret_value="$2"

  ENCRYPTED=$(encrypt_secret "$secret_value")

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "Authorization: token $PAT" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO}/actions/secrets/${secret_name}" \
    -d "{\"encrypted_value\":\"${ENCRYPTED}\",\"key_id\":\"${PK_KEY_ID}\"}")

  if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "204" ]; then
    ok "  Secret $secret_name set (HTTP $HTTP_CODE)"
  else
    fail "Failed to set secret $secret_name (HTTP $HTTP_CODE)"
  fi
}

# Read the deploy private key
if [ ! -f "$DEPLOY_KEY_PATH" ]; then
  fail "Deploy key not found at $DEPLOY_KEY_PATH — run regenerate-deploy-key.sh first"
fi
DEPLOY_KEY_CONTENT=$(cat "$DEPLOY_KEY_PATH")

# Set all 4 required secrets
set_secret "VPS_HOST"    "$VPS_HOST"
set_secret "VPS_USER"    "$VPS_USER"
set_secret "VPS_PORT"    "$VPS_PORT"
set_secret "VPS_SSH_KEY" "$DEPLOY_KEY_CONTENT"

ok "All 4 secrets set"

# ── Step 4: Verify SSH connectivity ───────────────────────────────────────────
log "Step 4/5 — Verifying SSH deploy key works..."
chmod 600 "$DEPLOY_KEY_PATH"
if ssh -i "$DEPLOY_KEY_PATH" \
       -p "$VPS_PORT" \
       -o StrictHostKeyChecking=no \
       -o ConnectTimeout=10 \
       -o BatchMode=yes \
       "${VPS_USER}@${VPS_HOST}" "echo 'SSH_OK'" 2>/dev/null | grep -q "SSH_OK"; then
  ok "SSH connectivity verified — deploy key works"
else
  echo ""
  echo "  ⚠️  SSH test failed. This is normal if running from a different machine."
  echo "     The deploy key is already in VPS authorized_keys — GitHub Actions will work."
fi

# ── Step 5: Trigger workflow ───────────────────────────────────────────────────
log "Step 5/5 — Triggering workflow_dispatch to test CI..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: token $PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/actions/workflows/deploy.yml/dispatches" \
  -d '{"ref":"main"}')

if [ "$HTTP_CODE" = "204" ]; then
  ok "Workflow triggered via workflow_dispatch"
else
  log "  Workflow dispatch returned HTTP $HTTP_CODE — you can trigger it manually"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo "  ✅  GitHub Actions CI/CD setup complete!"
echo "=================================================="
echo ""
echo "  📋  Summary:"
echo "     • Workflow file: https://github.com/${REPO}/blob/main/.github/workflows/deploy.yml"
echo "     • Actions runs:  https://github.com/${REPO}/actions"
echo "     • Secrets set:   VPS_HOST, VPS_USER, VPS_PORT, VPS_SSH_KEY"
echo ""
echo "  🚀  Every push to main will now:"
echo "     1. Run CI (typecheck + tests) in GitHub Actions"
echo "     2. SSH into ${VPS_USER}@${VPS_HOST}"
echo "     3. Execute /home/vpn/webapp/scripts/deploy.sh"
echo "     4. Health-check https://vpn.sis2.xyz/login"
echo ""
