# OVPN Admin Panel

> Self-hosted admin panel for managing **OpenVPN XOR** nodes — DPI-bypassing VPN
> servers — with per-client traffic accounting, **real-time traffic monitoring**,
> seamless server migration, and a **glassmorphism dark-mode UI**.

[![Version](https://img.shields.io/badge/version-1.3.0-06b6d4?style=flat-square)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square)](LICENSE)

**Live panel:** [https://vpn.sis2.xyz](https://vpn.sis2.xyz)

---

## Architecture

The panel **never connects to your nodes**. Each node runs a lightweight
**agent** that polls the panel over outbound HTTPS (works behind NAT/firewalls),
executes OpenVPN operations locally, and reports back.

```
                    ┌──────────────────────────────────┐
                    │        Panel  (Next.js 16)        │
                    │    UI  ·  REST API  ·  /api/*     │
                    └────────────┬─────────────────────┘
         ┌──────────────┬────────┴────────┬────────────────────────┐
    ┌────▼────┐   ┌─────▼───┐   ┌─────────▼────┐       outbound HTTPS
    │PostgreSQL│  │  Redis   │  │  Maintenance │       heartbeat poll
    │+encrypted│  │ rate-lmt │  │    Worker    │            │
    │PKI backup│  └──────────┘  │  (sweeps)    │   ┌────────▼──────┐
    └──────────┘                └──────────────┘   │     Agent     │
                                                   │  (Node.js 24) │
                                                   └───────┬───────┘
                                                   ┌───────▼────────┐
                                                   │ OpenVPN XOR    │
                                                   │ (the VPN)      │
                                                   └────────────────┘
```

---

## Features

| Feature | Detail |
|---|---|
| **Multi-node management** | Add and manage many VPN servers from one dashboard |
| **OpenVPN XOR** | Built-in XOR scramble mask to bypass DPI; configurable per node |
| **Configurable install** | Choose XOR mode, DNS, domain, cipher, MTU/MSSFIX — agent applies it all |
| **Real-time traffic monitor** | Live session table with per-client upload/download speed, VPN IP, real IP, session duration; per-node sparkline charts; fleet-wide totals — auto-refreshes every 5 s |
| **Seamless migration** | Full PKI backup (CA, certs, CRL, tls-crypt key, XOR mask) encrypted to panel; swap server with a DNS change — existing `.ovpn` files keep working |
| **Traffic accounting** | Cumulative upload/download per client; live online/offline status |
| **Client lifecycle** | Create, disable, revoke (CRL + immediate reload), download `.ovpn` |
| **RBAC** | `SUPERADMIN` / `ADMIN` full control · `MANAGER` scoped to assigned nodes/clients |
| **Audit logging** | Every administrative action recorded with actor, IP, and timestamp |
| **System monitoring** | CPU, RAM, disk, uptime, load average, connected clients — per node, live |
| **Maintenance worker** | Marks stale nodes UNHEALTHY, times out hung jobs, expires clients |
| **Hardened security** | CSP, HSTS, COOP, CORP, Permissions-Policy, bcrypt, AES-256-GCM, JWT HS256 |
| **Glassmorphism UI** | Frosted-glass surfaces, aurora background, cyan-violet brand glow |
| **Version display** | Version badge in topbar + sidebar; `GET /api/version` endpoint |

---

## UI Design System (v1.2.0+)

Built on Tailwind CSS 4 with a custom **glassmorphism dark-mode** design system:

- **3-tier glass surfaces** — `.glass` · `.glass-strong` (dialogs) · `.glass-card` (rows)
- **Aurora background** — 4-layer radial-gradient animation drifting over 28 s
- **Dot-grid overlay** — subtle dot pattern with radial fade mask
- **Glow utilities** — `.glow-cyan` · `.glow-violet` · `.glow-brand`
- **`glass-appear` animation** — blur-in entry for login card and modals
- **Gradient avatar** — sidebar user pill with cyan→violet gradient + halo glow
- **Dual-ring spinner** — counter-rotating rings in brand colours
- **SVG sparklines** — inline, zero-dependency sparkline charts in the traffic monitor

---

## Security

- **Hardened HTTP headers** — CSP (`script-src 'unsafe-inline'` for RSC streaming),
  HSTS (2 years + preload), COOP `same-origin`, CORP `same-origin`,
  X-Frame-Options `DENY`, Permissions-Policy (all sensors denied)
- **JWT** signed/verified with **jose** (HS256, enforced algorithm)
- **Fail-fast secrets** — panel refuses to start in production without strong
  `JWT_SECRET` / `ENCRYPTION_KEY` / `API_TOKEN_SALT`
- **Encrypted at rest** (AES-256-GCM) — PKI backups and client `.ovpn` artifacts
- **Login rate limiting** — Redis-backed dual limit (per-IP + per-email), fails open
- API tokens hashed (bcrypt); registration tokens are one-time and expire in 24 h
- Passwords hashed with **bcrypt**
- HttpOnly + SameSite cookie session — token never exposed to client JS
- `select` clauses on sensitive DB queries to prevent field leakage (`apiToken`, `pkiBackup`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Panel UI + API** | Next.js 16.2, React 19, TypeScript 6, Tailwind CSS 4 |
| **Component library** | Radix UI primitives, Lucide React 1.23, class-variance-authority |
| **Database** | PostgreSQL 16 + Prisma 7 |
| **Cache / rate-limit** | Redis 7 (ioredis 5) |
| **Auth** | jose 6 (JWT HS256), bcryptjs 3 |
| **Agent** | Node.js 24 LTS |
| **VPN** | OpenVPN 2.7.3 + XOR patch (built from source on the node) |
| **Process manager** | PM2 (production) |
| **Reverse proxy** | Nginx + Let's Encrypt (Certbot) |
| **Package manager** | pnpm 11.9 (monorepo workspaces) |

---

## Quick Start

### Prerequisites

- Ubuntu 22.04 / 24.04 server (production)
- Node.js 24 LTS, pnpm 11+
- PostgreSQL 16, Redis 7
- Nginx + Certbot (for SSL)
- At least one VPN node running Ubuntu 22.04 / 24.04

### Option A — Native (PM2 + Nginx) — recommended for production

```bash
# 1. Clone
git clone https://github.com/pt-zenity/VpnPro.git
cd VpnPro

# 2. Install system dependencies
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs postgresql redis-server nginx certbot python3-certbot-nginx
npm install -g pnpm pm2

# 3. Configure environment
cp .env.example .env
# Fill .env:
#   DATABASE_URL, REDIS_URL
#   JWT_SECRET      = $(openssl rand -base64 48)
#   ENCRYPTION_KEY  = $(openssl rand -hex 16)   # exactly 32 hex chars
#   API_TOKEN_SALT  = $(openssl rand -hex 24)
#   NEXT_PUBLIC_APP_URL = https://your-domain.com
#   PANEL_URL           = https://your-domain.com

# 4. Install dependencies + generate Prisma client
pnpm install
pnpm --filter @ovpn/db exec prisma generate

# 5. Apply schema + seed admin
pnpm --filter @ovpn/db exec prisma db push
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='strong-password' \
  pnpm exec tsx prisma/seed.ts

# 6. Build all apps
pnpm --filter @ovpn/panel build
pnpm --filter @ovpn/worker build

# 7. Copy standalone static assets
cp -r apps/panel/.next/static \
      apps/panel/.next/standalone/apps/panel/.next/static
cp -r apps/panel/public \
      apps/panel/.next/standalone/apps/panel/public

# 8. Start with PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup

# 9. SSL
certbot --nginx -d your-domain.com --non-interactive --agree-tos \
  --email admin@example.com --redirect
```

### Option B — Docker Compose

```bash
git clone https://github.com/pt-zenity/VpnPro.git
cd VpnPro
cp .env.example .env
# Fill .env with secrets + URLs, then:
docker compose -f docker/compose.yml up -d --build

# Apply schema + create admin:
docker compose -f docker/compose.yml run --rm worker \
  sh -c "pnpm prisma db push && \
         SEED_ADMIN_EMAIL=admin@example.com \
         SEED_ADMIN_PASSWORD='password' \
         pnpm exec tsx prisma/seed.ts"
```

---

## Adding a Node

1. **Dashboard → Nodes → Add Node** — enter a name and host IP.
2. Copy the generated install command and run it on your VPS **as root**:

   ```bash
   curl -fsSL https://vpn.sis2.xyz/api/agent/install.sh | \
     AGENT_TOKEN=<token> PANEL_URL=https://vpn.sis2.xyz bash
   ```

   This installs Node.js 24 LTS + the agent service. The node appears in the
   panel within seconds and shows **PROVISIONING**.

3. Click **Install OpenVPN** on the node page, choose your options:
   - Obfuscation (XOR mask / XOR position / Reverse / Compound / None)
   - Protocol (UDP / TCP) and port
   - Cipher (AES-256-GCM / AES-128-GCM / CHACHA20-POLY1305)
   - DNS mode (Standard 8.8.8.8 + 1.1.1.1 / None / Custom)
   - Tunnel mode (Full redirect-gateway / Split tunnel)
   - Domain, MTU, MSSFIX

   The agent builds OpenVPN XOR from source. Node transitions to **HEALTHY**.

> **Tip:** always set a **domain** so `.ovpn` files reference a hostname —
> a server migration then only requires a DNS record change.

---

## Server Migration

Moving a blocked or decommissioned server to a fresh VPS:

1. **Node details → Migrate Server** → confirm to generate a new install command.
2. Run that command on your **new** clean Ubuntu server.
3. Click **Install OpenVPN** — the agent restores the full PKI backup (CA,
   all client certs/keys, CRL, tls-crypt key, XOR mask) before installing.
4. Update your DNS record to point the domain at the new server IP.

Existing clients reconnect automatically — **no `.ovpn` redistribution needed**.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Min 32 chars — `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | ✅ | Exactly 32 hex chars (AES-256 key) — `openssl rand -hex 16` |
| `API_TOKEN_SALT` | ✅ | Min 16 chars — `openssl rand -hex 24` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public panel URL (e.g. `https://vpn.sis2.xyz`) |
| `PANEL_URL` | ✅ | Same as above (used server-side for agent install commands) |
| `NODE_ENV` | ✅ | `production` or `development` |
| `SEED_ADMIN_EMAIL` | seed | Admin email for initial seed |
| `SEED_ADMIN_PASSWORD` | seed | Admin password for initial seed |
| `AGENT_HEARTBEAT_INTERVAL` | — | Seconds between agent heartbeats (default `30`) |
| `AGENT_HEARTBEAT_TIMEOUT` | — | Timeout per heartbeat request in seconds (default `5`) |

---

## Project Structure

```
VpnPro/
├── apps/
│   ├── panel/                      # Next.js 16 admin UI + REST API
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── agent/          # Heartbeat, register, jobs, backup
│   │   │   │   ├── auth/           # Login, logout
│   │   │   │   ├── clients/        # Client CRUD + disable/enable/download
│   │   │   │   ├── dashboard/      # Stats aggregate
│   │   │   │   ├── nodes/          # Node CRUD + install + migrate
│   │   │   │   ├── traffic/        # Real-time traffic data (NEW v1.3.0)
│   │   │   │   └── version/        # Panel version endpoint (NEW v1.3.0)
│   │   │   ├── dashboard/
│   │   │   │   ├── audit/          # Audit log viewer
│   │   │   │   ├── clients/        # Global client list
│   │   │   │   ├── jobs/           # Job queue viewer
│   │   │   │   ├── managers/       # Manager RBAC management
│   │   │   │   ├── nodes/          # Node list + detail + clients
│   │   │   │   └── traffic/        # Real-time traffic monitor (NEW v1.3.0)
│   │   │   ├── login/              # Glassmorphism login page
│   │   │   └── layout.tsx          # Root layout (favicon, metadata)
│   │   └── src/
│   │       ├── components/
│   │       │   └── ui/             # Design system (card, button, badge, …)
│   │       └── lib/
│   │           ├── auth.ts         # Session, cookie, IP extraction
│   │           ├── crypto.ts       # JWT, bcrypt, AES-256-GCM
│   │           ├── middleware.ts   # withAuth / withFullAdmin HOFs
│   │           ├── rate-limit.ts   # Redis fixed-window rate limiter
│   │           └── version.ts      # Single version source (NEW v1.3.0)
│   ├── agent/                      # Node.js agent (runs on each VPN server)
│   └── worker/                     # Maintenance daemon (stale nodes, timeouts)
├── packages/
│   ├── api/                        # Zod request/response validators
│   ├── db/                         # Prisma client re-export
│   └── types/                      # Shared TypeScript interfaces
├── prisma/
│   └── schema.prisma               # Database schema (9 models)
├── scripts/
│   ├── deploy.sh                   # VPS deploy script (pull→build→pm2 reload)
│   └── setup-github-actions.sh     # One-time CI/CD setup helper
├── ecosystem.config.js             # PM2 process config (panel + worker)
├── nginx.ovpn-admin.conf           # Nginx reverse proxy config (reference)
├── CHANGELOG.md
└── .env.example
```

---

## Development

```bash
# 1. Clone & install
git clone https://github.com/pt-zenity/VpnPro.git
cd VpnPro
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, secrets,
# and NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Generate Prisma client + apply schema
pnpm --filter @ovpn/db exec prisma generate
pnpm --filter @ovpn/db exec prisma db push

# 4. Seed initial admin
SEED_ADMIN_EMAIL=admin@dev.local SEED_ADMIN_PASSWORD=devpassword \
  pnpm exec tsx prisma/seed.ts

# 5. Start panel (port 3000) + worker
pnpm --filter @ovpn/panel dev

# 6. Run unit tests
pnpm --filter @ovpn/panel test --run
```

### Available Scripts

| Command | Description |
|---|---|
| `pnpm --filter @ovpn/panel dev` | Start panel in dev/watch mode (port 3000) |
| `pnpm --filter @ovpn/panel build` | Production build (standalone output) |
| `pnpm --filter @ovpn/worker build` | Compile worker TypeScript |
| `pnpm --filter @ovpn/panel test --run` | Run Vitest unit tests (23 tests) |
| `pnpm --filter @ovpn/panel exec tsc --noEmit` | TypeScript type check |
| `pnpm --filter @ovpn/db exec prisma generate` | Regenerate Prisma client |
| `pnpm --filter @ovpn/db exec prisma migrate dev` | Create + apply migration |
| `pnpm --filter @ovpn/db exec prisma migrate deploy` | Apply migrations (production) |
| `pnpm --filter @ovpn/db exec prisma db push` | Sync schema (dev, no migration file) |

---

## Production Operations

### Deploy (current VPS — `main` = production)

```bash
# Pull latest + full redeploy (zero-downtime PM2 reload)
bash /home/vpn/webapp/scripts/deploy.sh
```

The script handles: `git pull` → `pnpm install` → `prisma migrate deploy` →
`panel build` → `worker build` → copy static assets → `pm2 reload`.

### Service management (PM2)

```bash
pm2 status                     # check panel + worker
pm2 logs ovpn-panel            # tail panel logs
pm2 logs ovpn-worker           # tail worker logs
pm2 reload ovpn-panel          # zero-downtime reload (after build)
pm2 reload ovpn-worker         # reload worker
pm2 save                       # persist process list across reboots
```

### Manual build & reload

```bash
cd /home/vpn/webapp

# Build panel
pnpm --filter @ovpn/panel build

# Copy standalone static assets (required after every panel build)
cp -r apps/panel/.next/static \
      apps/panel/.next/standalone/apps/panel/.next/static
cp -r apps/panel/public \
      apps/panel/.next/standalone/apps/panel/public

# Reload (zero-downtime)
pm2 reload ovpn-panel --update-env
pm2 reload ovpn-worker --update-env
pm2 save
```

### Check current version

```bash
# From the server
curl -s http://localhost:3000/api/version | python3 -m json.tool
# → { "version": "1.3.0", "label": "v1.3.0", "name": "OVPN Admin Panel", "builtAt": "..." }

# From browser (no auth required)
curl -s https://vpn.sis2.xyz/api/version
```

### Agent logs (on the VPN node)

```bash
journalctl -u ovpn-agent -f        # real-time agent logs
systemctl status ovpn-agent        # service status
systemctl restart ovpn-agent       # restart agent
```

### SSL renewal

Certbot auto-renews via a systemd timer. To renew manually:

```bash
certbot renew --dry-run             # test
certbot renew && nginx -s reload    # renew + reload Nginx
```

---

## API Reference

All endpoints (except `/api/version` and `/api/agent/*`) require an
`auth_token` HttpOnly session cookie.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/version` | Panel version + build time (public) |
| `POST` | `/api/auth/login` | Authenticate (rate-limited) |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/dashboard/stats` | Fleet stats (nodes, clients, jobs) |
| `GET` | `/api/traffic` | **Real-time traffic** — sessions, node aggregates, sparklines |
| `GET` | `/api/nodes` | List nodes |
| `POST` | `/api/nodes` | Create node (full admin) |
| `GET` | `/api/nodes/:id` | Node details + latest health status |
| `PATCH` | `/api/nodes/:id` | Update node (full admin) |
| `DELETE` | `/api/nodes/:id` | Delete node (full admin) |
| `POST` | `/api/nodes/:id/install` | Trigger OpenVPN install (full admin) |
| `GET` | `/api/nodes/:id/install-progress` | Poll install progress |
| `POST` | `/api/nodes/:id/migrate-token` | Generate server migration token |
| `GET` | `/api/nodes/:id/clients` | List clients for a node |
| `POST` | `/api/nodes/:id/clients` | Create VPN client |
| `GET` | `/api/clients/:id` | Client detail |
| `DELETE` | `/api/clients/:id` | Revoke client |
| `POST` | `/api/clients/:id/disable` | Disable client (reversible) |
| `POST` | `/api/clients/:id/enable` | Re-enable client |
| `GET` | `/api/clients/:id/download` | Download `.ovpn` config |
| `GET` | `/api/jobs` | List jobs |
| `GET` | `/api/jobs/:id` | Job detail |
| `GET` | `/api/audit-logs` | Audit log (full admin) |
| `GET` | `/api/admins` | List managers (full admin) |
| `POST` | `/api/admins` | Create manager (full admin) |
| `PATCH` | `/api/admins/:id` | Update manager |
| `DELETE` | `/api/admins/:id` | Delete manager |

---

## Troubleshooting

**Agent won't connect to the panel**
```bash
# On the VPN node:
journalctl -u ovpn-agent -n 50 --no-pager
curl -v https://vpn.sis2.xyz/api/agent/install.sh
```

**OpenVPN won't start**
```bash
systemctl status openvpn-xor
tail -f /var/log/openvpn-xor.log
/usr/local/sbin/openvpn-xor --config /etc/openvpn/xor/server.conf --verb 7
```

**Panel returns 500 / database errors**
```bash
pm2 logs ovpn-panel --lines 50
# Re-apply schema after a version update:
pnpm --filter @ovpn/db exec prisma migrate deploy
pm2 reload ovpn-panel --update-env
```

**Login rate-limit hit**
```bash
redis-cli --scan --pattern 'rate:*' | xargs redis-cli del
```

**Traffic page shows no sessions**

The traffic monitor reads data written by the agent heartbeat. Data appears
within one heartbeat cycle (~30 s) after clients connect. If the node status
is not `HEALTHY`, no session data is collected.

---

## Client Setup

Downloaded `.ovpn` files work with any OpenVPN client that supports the XOR
scramble patch (when XOR obfuscation is enabled on the node):

| Platform | Client |
|---|---|
| Android | OpenVPN for Android (by Arne Schwabe) |
| iOS | OpenVPN Connect |
| macOS | Viscosity, Tunnelblick (XOR-patched build) |
| Windows | OpenVPN GUI (XOR-patched build) |
| Linux | `openvpn --config client.ovpn` (XOR-patched build) |

> **Important:** when XOR obfuscation is enabled, clients must use an
> OpenVPN build compiled with the XOR patch. Standard builds will fail to
> connect.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

**Latest: [v1.3.0](CHANGELOG.md#130---2026-07-04)**
Real-time traffic monitor dashboard, version display in UI,
security audit fixes, hardened CSP/headers, favicon, and CI/CD scripts.

---

## License

MIT — see [LICENSE](LICENSE) for details.
