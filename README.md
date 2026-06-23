# OpenVPN Admin Panel

Self-hosted admin panel for managing OpenVPN XOR nodes with seamless migration and real-time monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Panel (Next.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │   UI/App    │  │  API Routes │  │  Background Workers │ │
│  └─────────────┘  └─────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                        │                    │
    ┌────▼─────┐          ┌─────▼──────┐       ┌─────▼─────┐
    │PostgreSQL│          │   Redis    │       │  Agent    │
    └──────────┘          │  (BullMQ)  │       │  (Node.js) │
                          └────────────┘       └───────┬─────┘
                                                  │
                                          ┌───────▼────────┐
                                          │  VPN Node      │
                                          │  OpenVPN XOR   │
                                          └────────────────┘
```

## Features

- **Multi-node Management** - Add and manage multiple VPN servers from a single dashboard.
- **OpenVPN XOR Patch** - Built-in support for XOR Scramble Mask to bypass Deep Packet Inspection (DPI) and firewalls.
- **Seamless Server Migration** - Automatically back up PKI (certificates/keys) to the database. Deploy a new VPS and migrate your node with 1 click without breaking existing client `.ovpn` files!
- **Client Lifecycle Management** - Create, revoke (with fully working CRL validation), and download `.ovpn` configs easily.
- **Agent-based Architecture** - Secure polling communication using JWT tokens (works seamlessly behind NAT).
- **Live Installation Progress** - Real-time progress bars when deploying OpenVPN to new nodes.
- **System Monitoring** - View server OS, Architecture, CPU, RAM, and Uptime directly in the panel.
- **Audit Logging** - Track all administrative actions.
- **Job Queue** - Background operations with BullMQ and retry logic.

## Tech Stack

- **Panel**: Next.js 15, TypeScript, Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: Redis + BullMQ
- **Agent**: Node.js, Axios
- **VPN**: OpenVPN 2.7.3 with XOR patch

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- VPN server(s) with Ubuntu 22.04/24.04

### Option A: Install from GitHub (Recommended for Production)

```bash
# Quick install with auto-configuration
curl -fsSL https://github.com/tunnect-spec/ovpn-admin/raw/main/quick-install.sh | sudo bash

# Or with custom domain
curl -fsSL https://github.com/tunnect-spec/ovpn-admin/raw/main/quick-install.sh | \
  sudo DOMAIN=vpn.example.com bash
```

This will:
- Install Docker & Docker Compose
- Generate secure secrets
- Set up PostgreSQL + Redis
- Build and start all services
- Create an admin user with a generated password

### Option B: Manual Installation

#### 1. Clone & Setup

```bash
git clone https://github.com/tunnect-spec/ovpn-admin.git
cd ovpn-admin
cp .env.example .env
# Edit .env with your settings
```

#### 2. Start Services

```bash
docker-compose up -d
```

#### 3. Create Admin User

```bash
docker exec -it ovpn-admin-panel npx prisma db push
docker exec -it ovpn-admin-panel node -e "
  const { hashPassword } = require('./dist/lib/crypto.js');
  const { prisma } = require('./dist/lib/prisma.js');
  (async () => {
    const admin = await prisma.admin.create({
      data: {
        email: 'admin@example.com',
        passwordHash: await hashPassword('your-password'),
        role: 'SUPERADMIN',
      },
    });
    console.log('Admin created:', admin.email);
  })().catch(console.error);
"
```

#### 4. Add Your First Node

1. Login at http://localhost:3000/login
2. Go to Nodes → Add Node
3. Enter name and host
4. Copy the install command
5. Run on your VPN server (as root)
6. Wait for node status to become `PENDING`

#### 5. Install OpenVPN

1. Go to Node Details → Install OpenVPN
2. Configure Port, Protocol, XOR mask, and DNS options
3. Watch the live progress bar!
4. The first client will be created automatically.

### Server Migration

Is your server IP blocked? You can migrate it effortlessly:
1. Go to Node Details -> Migrate Server.
2. Confirm the action to receive a new migration token.
3. Run the provided command on your **new** clean VPS.
4. The panel will automatically inject your old CA/Certificates into the new server. Clients will reconnect immediately once you update your DNS records!

## Project Structure

```
ovpn-admin/
├── apps/
│   ├── panel/          # Next.js admin UI
│   ├── agent/          # Node agent (Node.js service)
│   └── worker/         # BullMQ background worker
├── packages/
│   ├── api/            # Zod validators
│   ├── db/             # Prisma schema & client
│   └── types/          # Shared TypeScript types
├── docker/
│   └── compose.yml     # Docker services
└── prisma/
    └── schema.prisma   # Database schema
```

## Security Notes

- Full default traffic tunneling (`redirect-gateway def1 bypass-dhcp`).
- Proper Revocation Lists (`crl-verify`).
- All agent communication uses HTTPS + token auth.
- API tokens are encrypted at rest (AES-256-GCM).
- Registration tokens are one-time, expire in 24h.
- PKI Backup blobs are stored securely in the PostgreSQL database.

## License

MIT
