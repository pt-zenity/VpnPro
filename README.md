# OVPN Admin Panel

> Self-hosted admin panel for managing **OpenVPN XOR** nodes — DPI-bypassing VPN
> servers — with per-client traffic accounting, real-time monitoring, seamless
> server migration, and a **glassmorphism dark-mode UI**.

[![Version](https://img.shields.io/badge/version-1.2.0-06b6d4?style=flat-square)](CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square)](LICENSE)

---

## Screenshots

| Login | Dashboard | Nodes |
|---|---|---|
| Glassmorphism login card with floating aurora orbs | Real-time stats cards with frosted-glass surfaces | Node list with health indicators and glass rows |

---

## Architecture

The panel **never connects to your nodes**. Each node runs a lightweight
**agent** that polls the panel over outbound HTTPS (works behind NAT/firewalls),
executes OpenVPN operations locally, and reports back.

```
                    ┌──────────────────────────────┐
                    │        Panel  (Next.js 16)    │
                    │     UI  ·  REST API routes    │
                    └────────────┬─────────────────┘
         ┌──────────────┬────────┴──────┬──────────────────────┐
    ┌────▼────┐   ┌─────▼───┐   ┌───────▼──────┐    outbound HTTPS
    │PostgreSQL│  │  Redis   │  │  Maintenance │    heartbeat poll
    │+encrypted│  │ rate-lmt │  │    Worker    │        │
    │PKI backup│  └──────────┘  │  (sweeps)    │   ┌────▼──────┐
    └──────────┘                └──────────────┘   │   Agent   │
                                                   │ (Node.js) │
                                                   └─────┬─────┘
                                                   ┌─────▼──────┐
                                                   │OpenVPN XOR │
                                                   │ (the VPN)  │
                                                   └────────────┘
```

---

## Features

| Feature | Detail |
|---|---|
| **Multi-node management** | Add and manage many VPN servers from one dashboard |
| **OpenVPN XOR** | Built-in XOR scramble mask to bypass DPI; toggled on/off per node |
| **Configurable install** | Choose XOR, DNS mode, domain, MTU/MSSFIX — agent applies it all |
| **Seamless migration** | Full PKI backup (CA, certs, CRL, tls-crypt key, XOR mask) encrypted to panel; swap server with a DNS change — existing `.ovpn` files keep working |
| **Traffic accounting** | Cumulative upload/download per client; live online/offline status |
| **Client lifecycle** | Create, revoke (CRL + immediate reload), download `.ovpn` |
| **RBAC** | `ADMIN` full control · `MANAGER` scoped to their own nodes/clients |
| **Audit logging** | Every administrative action recorded with actor + timestamp |
| **System monitoring** | CPU, RAM, disk, uptime, connected clients — per node |
| **Maintenance worker** | Marks stale nodes UNHEALTHY, times out jobs, expires clients |
| **Glassmorphism UI** | Frosted-glass surfaces, aurora background, cyan-violet brand glow |

---

## UI Design System (v1.2.0)

The panel ships a custom **glassmorphism dark-mode** design system built on
Tailwind CSS 4:

- **3-tier glass surfaces** — `.glass` · `.glass-strong` (dialogs) · `.glass-card` (rows)
- **Aurora background** — 4-layer radial-gradient animation drifting over 28 s
- **Dot-grid overlay** — subtle dot pattern with radial fade mask
- **Glow utilities** — `.glow-cyan` · `.glow-violet` · `.glow-brand`
- **`glass-appear` animation** — blur-in entry for login card and modals
- **Gradient avatar** — sidebar user pill with cyan→violet gradient + halo glow
- **Dual-ring spinner** — counter-rotating rings in brand colours

---

## Security

- JWT signed/verified with **jose** (HS256, enforced algorithm)
- **Fail-fast secrets** — panel refuses to start in production without strong
  `JWT_SECRET` / `ENCRYPTION_KEY` / `API_TOKEN_SALT`
- **Encrypted at rest** (AES-256-GCM) — PKI backups *and* client `.ovpn` artifacts
- **Login rate limiting** — Redis-backed, fails open
- API tokens hashed (bcrypt); registration tokens are one-time and expire in 24 h
- Admin passwords hashed with **bcrypt**
- HttpOnly + SameSite cookie session — no token exposed to client JS

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Panel UI + API** | Next.js 16.2, React 19, TypeScript 6, Tailwind CSS 4 |
| **Component library** | Radix UI primitives, Lucide React 1.23, class-variance-authority |
| **Database** | PostgreSQL 16 + Prisma 7 (driver adapter) |
| **Cache / rate-limit** | Redis 7 (ioredis 5) |
| **Auth** | jose 6 (JWT HS256), bcryptjs 3 |
| **Agent** | Node.js 24 LTS, Axios 1.8 |
| **VPN** | OpenVPN 2.7.3 + XOR patch (built from source on the node) |
| **Process manager** | PM2 7 (production) |
| **Reverse proxy** | Nginx + Let's Encrypt (Certbot) |
| **Package manager** | pnpm 11.9 |

---

## Quick Start

### Prerequisites

- **Production**: Ubuntu 22.04 / 24.04 server, Docker & Docker Compose
- **Development**: Node.js 20+, pnpm 9+
- At least one VPN node running Ubuntu 22.04 / 24.04

### Option A — one command (recommended)

```bash
# Bare Ubuntu server:
curl -fsSL https://raw.githubusercontent.com/tunnect-spec/ovpn-admin/main/quick-install.sh | sudo bash

# With your domain (recommended for production — required for TLS):
curl -fsSL https://raw.githubusercontent.com/tunnect-spec/ovpn-admin/main/quick-install.sh | \
  sudo DOMAIN=vpn.example.com bash
```

Installs Docker, generates secrets, builds and starts everything (Postgres,
Redis, panel, worker), applies the schema, creates an admin, and **prints the
panel URL + credentials** at the end. Re-running reuses existing secrets.

### Option B — manual (Docker Compose)

```bash
git clone https://github.com/pt-zenity/VpnPro.git
cd VpnPro
cp .env.example .env

# Fill .env with strong secrets:
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEY=$(openssl rand -hex 16)
API_TOKEN_SALT=$(openssl rand -hex 24)
POSTGRES_PASSWORD=$(openssl rand -hex 24)

# Set NEXT_PUBLIC_APP_URL and PANEL_URL to your panel's public URL.
# Then start everything:
docker compose -f docker/compose.yml up -d --build

# Apply schema + create admin:
docker compose -f docker/compose.yml run --rm --user root \
  -e SEED_ADMIN_EMAIL=admin@example.com \
  -e SEED_ADMIN_PASSWORD='your-strong-password' \
  worker sh -lc "corepack enable; pnpm prisma db push && pnpm exec tsx prisma/seed.ts"
```

### Option C — native (PM2 + Nginx)

```bash
git clone https://github.com/pt-zenity/VpnPro.git
cd VpnPro
cp .env.example .env          # fill in all secrets + URLs

# Install Node.js 22 + pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs postgresql redis-server nginx certbot python3-certbot-nginx
npm install -g pnpm pm2

# Install deps, generate Prisma client, push schema, seed admin
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm db:seed                  # reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from .env

# Build all apps
pnpm build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup       # auto-restart on reboot

# Nginx + SSL
certbot --nginx -d vpn.example.com --non-interactive --agree-tos \
  --email admin@example.com --redirect
```

---

## Adding a Node

1. **Panel → Nodes → Add Node** — enter a name and host.
2. Copy the generated install command and run it on your VPS as root:

   ```bash
   curl -fsSL https://vpn.sis2.xyz/api/agent/install.sh | \
     AGENT_TOKEN=<token> PANEL_URL=https://vpn.sis2.xyz bash
   ```

   This installs Node.js 24 LTS + the agent service. The node appears in the
   panel within seconds.

3. **Install OpenVPN** — open the node in the panel, click **Install OpenVPN**,
   choose your options (XOR on/off, DNS, domain, MTU/MSSFIX). The agent builds
   OpenVPN XOR from source. The first client is created automatically.

> **Tip:** always set a **domain** so client `.ovpn` files reference a hostname,
> making a server migration a single DNS change.

---

## Server Migration

Moving a blocked server to a fresh VPS:

1. **Node details → Migrate Server** → confirm to generate a new install command.
2. Run that command on your **new** clean VPS.
3. Click **Install OpenVPN** — the agent restores the backed-up PKI (CA, all
   client certs/keys, CRL, tls-crypt key, XOR mask) before installing.
4. Re-point your domain DNS to the new server IP.  
   Existing clients reconnect using their current `.ovpn` — nothing to redistribute.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | ✅ | Used by Docker Compose postgres service |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Min 32 chars — `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | ✅ | Exactly 32 chars (AES-256 key) — `openssl rand -hex 16` |
| `API_TOKEN_SALT` | ✅ | Min 16 chars — `openssl rand -hex 24` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the panel (e.g. `https://vpn.sis2.xyz`) |
| `PANEL_URL` | ✅ | Same as above (used server-side for agent commands) |
| `NODE_ENV` | ✅ | `production` or `development` |
| `SEED_ADMIN_EMAIL` | seed | Admin email for `pnpm db:seed` |
| `SEED_ADMIN_PASSWORD` | seed | Admin password for `pnpm db:seed` |
| `AGENT_HEARTBEAT_INTERVAL` | — | Seconds between agent heartbeats (default `30`) |
| `AGENT_HEARTBEAT_TIMEOUT` | — | Timeout per heartbeat request in seconds (default `5`) |

---

## Project Structure

```
VpnPro/
├── apps/
│   ├── panel/                  # Next.js 16 admin UI + REST API
│   │   ├── app/                # App Router pages & API routes
│   │   │   ├── api/            # REST endpoints (auth, nodes, clients, jobs, …)
│   │   │   ├── dashboard/      # Protected dashboard pages
│   │   │   └── login/          # Glassmorphism login page
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   │   └── ui/         # Design system (card, button, input, badge, …)
│   │   │   └── lib/            # Auth, crypto, Prisma client, rate-limit, …
│   │   └── tailwind.config.mts # Glassmorphism theme config
│   ├── agent/                  # Node.js agent (runs on each VPN server)
│   └── worker/                 # Maintenance daemon (stale nodes, job timeouts)
├── packages/
│   ├── api/                    # Zod request/response validators
│   ├── db/                     # Prisma schema & generated client
│   └── types/                  # Shared TypeScript types
├── docker/
│   ├── compose.yml             # Production Docker Compose
│   ├── panel.Dockerfile
│   └── worker.Dockerfile
├── prisma/
│   └── schema.prisma           # Database schema (8 models)
├── ecosystem.config.js         # PM2 process config (production)
├── install-agent.sh            # Agent one-command installer (served by panel)
├── install-openvpn-xor.sh      # OpenVPN XOR builder (run by agent)
├── quick-install.sh            # All-in-one server installer
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
# Edit .env — set DATABASE_URL, secrets, and NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Start Postgres + Redis (Docker)
docker compose -f docker/compose.yml up -d postgres redis

# 4. Apply schema & seed admin
pnpm prisma generate
pnpm prisma db push
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='dev-password' pnpm db:seed

# 5. Start panel + worker
pnpm dev          # panel on :3000, worker concurrently

# 6. Run tests
pnpm test         # Vitest unit tests
```

### Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start panel + worker in watch mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run Vitest unit tests |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Sync Prisma schema to DB (no migration file) |
| `pnpm db:seed` | Create initial admin user |
| `pnpm db:migrate` | Create Prisma migration |
| `pnpm docker:up` | Start all Docker services |
| `pnpm docker:down` | Stop all Docker services |
| `pnpm docker:logs` | Tail Docker Compose logs |

---

## Production Operations

### Service management (PM2)

```bash
pm2 status                   # check panel + worker status
pm2 logs ovpn-panel          # tail panel logs
pm2 logs ovpn-worker         # tail worker logs
pm2 restart ovpn-panel       # restart panel (after a build update)
pm2 restart ovpn-worker      # restart worker
pm2 save                     # persist process list across reboots
```

### Update to latest

```bash
cd /path/to/VpnPro
git pull origin main
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm build

# Copy standalone static assets
cp -r apps/panel/.next/static apps/panel/.next/standalone/apps/panel/.next/static
cp -r apps/panel/public apps/panel/.next/standalone/apps/panel/public

pm2 restart ovpn-panel ovpn-worker
```

### Agent logs (on the VPN node)

```bash
journalctl -u ovpn-agent -f          # real-time agent logs
systemctl status ovpn-agent          # service status
systemctl restart ovpn-agent         # restart agent
```

### SSL renewal

Certbot auto-renews via a systemd timer. To renew manually:

```bash
certbot renew --dry-run               # test
certbot renew && nginx -s reload      # renew + reload Nginx
```

---

## Troubleshooting

**Agent won't connect to the panel**
```bash
# On the VPN node:
journalctl -u ovpn-agent -n 50 --no-pager
curl -v https://vpn.sis2.xyz/api/agent/install.sh   # test panel reachability
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
# Re-sync schema if you updated the codebase:
pnpm prisma db push
pm2 restart ovpn-panel
```

**Login rate-limit hit**
```bash
# Redis stores rate-limit keys — flush only the limiter namespace:
redis-cli --scan --pattern 'rate:*' | xargs redis-cli del
```

---

## Client Setup

Downloaded `.ovpn` files work with any OpenVPN client that supports the XOR
scramble patch:

| Platform | Client |
|---|---|
| Android | OpenVPN for Android (by Arne Schwabe) |
| iOS | OpenVPN Connect |
| macOS | Viscosity, Tunnelblick (with XOR patch) |
| Windows | OpenVPN GUI (with XOR patch) |
| Linux | `openvpn --config client.ovpn` (XOR-patched build) |

> **Important:** clients must use an OpenVPN build compiled with the XOR
> patch. Standard builds will fail to connect when XOR is enabled on the node.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full release history.

**Latest: [v1.2.0](CHANGELOG.md#120---2026-07-03)**  
Full glassmorphism dark-mode redesign — 3-tier glass surfaces, aurora
animation, gradient glow, glass-aware UI components.

---

## Contributing

1. Fork the repo and create a feature branch.
2. Follow the existing code style (TypeScript strict, Tailwind utility classes).
3. Run `pnpm test` and `pnpm lint` before submitting.
4. Open a pull request against `main` with a clear description.

---

## License

MIT — see [LICENSE](LICENSE) for details.
