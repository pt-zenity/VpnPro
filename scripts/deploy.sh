#!/usr/bin/env bash
# =============================================================================
# deploy.sh — VPS-side deployment script
#
# Called by the GitHub Actions workflow via SSH after a successful CI run.
# Can also be run manually on the VPS for hotfixes:
#   bash /home/vpn/webapp/scripts/deploy.sh
#
# What it does:
#   1. Pull latest code from GitHub (main branch)
#   2. Install / update Node dependencies (frozen lockfile)
#   3. Run Prisma migrations (safe — only applies new migrations)
#   4. Build Next.js panel (standalone output)
#   5. Build TypeScript worker
#   6. Copy static assets into standalone dir
#   7. PM2 reload (zero-downtime graceful restart)
#   8. Verify both processes are online
#
# Exit codes: 0 = success, non-zero = failure (GitHub Actions marks as failed)
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
WEBAPP_DIR="/home/vpn/webapp"
LOG_FILE="/var/log/ovpn-deploy.log"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[${TIMESTAMP}] $*" | tee -a "$LOG_FILE"; }
ok()   { echo "[${TIMESTAMP}] ✅ $*" | tee -a "$LOG_FILE"; }
fail() { echo "[${TIMESTAMP}] ❌ $*" | tee -a "$LOG_FILE"; exit 1; }

# ── Start ─────────────────────────────────────────────────────────────────────
log "============================================================"
log "  OVPN Admin — Deploy started"
log "============================================================"

cd "$WEBAPP_DIR" || fail "Cannot cd to $WEBAPP_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
log "Step 1/7 — git pull"
BEFORE_SHA="$(git rev-parse --short HEAD)"
git fetch origin main 2>&1 | tee -a "$LOG_FILE"
git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"
AFTER_SHA="$(git rev-parse --short HEAD)"

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  log "  No new commits (still at $AFTER_SHA) — continuing anyway (may be a manual re-deploy)"
else
  ok "  Updated $BEFORE_SHA → $AFTER_SHA"
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
log "Step 2/7 — pnpm install (frozen)"
pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG_FILE"
ok "  Dependencies installed"

# ── 3. Prisma migrate ─────────────────────────────────────────────────────────
log "Step 3/7 — prisma migrate deploy"
# Load .env so DATABASE_URL is available to prisma
set -a; source "$WEBAPP_DIR/.env"; set +a
pnpm --filter @ovpn/db exec prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"
ok "  Prisma migrations applied"

# ── 4. Build panel ────────────────────────────────────────────────────────────
log "Step 4/7 — build Next.js panel"
pnpm --filter @ovpn/panel build 2>&1 | tee -a "$LOG_FILE"
ok "  Panel built"

# ── 5. Build worker ───────────────────────────────────────────────────────────
log "Step 5/7 — build TypeScript worker"
pnpm --filter @ovpn/worker build 2>&1 | tee -a "$LOG_FILE"
ok "  Worker built"

# ── 6. Copy static assets into standalone dir ─────────────────────────────────
log "Step 6/7 — copy static assets to standalone"
STANDALONE="$WEBAPP_DIR/apps/panel/.next/standalone/apps/panel"

# Static chunks (/_next/static/…)
cp -r "$WEBAPP_DIR/apps/panel/.next/static" "$STANDALONE/.next/static"

# Public folder (favicon.ico, etc.) — create if first deploy
mkdir -p "$STANDALONE/public"
if [ -d "$WEBAPP_DIR/apps/panel/public" ]; then
  cp -r "$WEBAPP_DIR/apps/panel/public/." "$STANDALONE/public/"
fi

ok "  Static assets copied"

# ── 7. PM2 reload (zero-downtime) ─────────────────────────────────────────────
log "Step 7/7 — PM2 reload"

# `pm2 reload` sends SIGINT → waits for graceful shutdown → starts new instance
# If a process doesn't exist yet, `pm2 start` ecosystem.config.js creates it.

if pm2 list | grep -q "ovpn-panel"; then
  pm2 reload ovpn-panel --update-env 2>&1 | tee -a "$LOG_FILE"
else
  pm2 start "$WEBAPP_DIR/ecosystem.config.js" --only ovpn-panel 2>&1 | tee -a "$LOG_FILE"
fi

if pm2 list | grep -q "ovpn-worker"; then
  pm2 reload ovpn-worker --update-env 2>&1 | tee -a "$LOG_FILE"
else
  pm2 start "$WEBAPP_DIR/ecosystem.config.js" --only ovpn-worker 2>&1 | tee -a "$LOG_FILE"
fi

# Save PM2 process list so it survives a server reboot
pm2 save 2>&1 | tee -a "$LOG_FILE"

ok "  PM2 reloaded"

# ── 8. Verify ─────────────────────────────────────────────────────────────────
sleep 3
PANEL_STATUS="$(pm2 list | grep ovpn-panel | awk '{print $18}' | head -1)"
WORKER_STATUS="$(pm2 list | grep ovpn-worker | awk '{print $18}' | head -1)"

log "  ovpn-panel  status: ${PANEL_STATUS:-unknown}"
log "  ovpn-worker status: ${WORKER_STATUS:-unknown}"

# Check panel is accepting requests locally
for i in $(seq 1 10); do
  HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo '000')"
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    ok "  Panel responding locally (HTTP $HTTP_CODE)"
    break
  fi
  if [ "$i" = "10" ]; then
    fail "Panel not responding after 10 attempts (last HTTP code: $HTTP_CODE)"
  fi
  log "  Waiting for panel… attempt $i/10 (HTTP $HTTP_CODE)"
  sleep 3
done

# ── Done ──────────────────────────────────────────────────────────────────────
log "============================================================"
ok "  Deploy COMPLETE — commit $AFTER_SHA"
log "  Log: $LOG_FILE"
log "============================================================"
