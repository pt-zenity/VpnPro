# OpenVPN Admin Panel - Setup Guide

Complete setup instructions for the self-hosted OpenVPN admin panel.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** & Docker Compose
- **VPN Server** with Ubuntu 22.04/24.04

## Quick Start

### 1. Clone & Install

```bash
cd ovpn-admin
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Required variables:
```bash
DATABASE_URL="postgresql://ovpn:yourpassword@localhost:5432/ovpn_admin"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-min-32-chars"
```

### 3. Start Services

```bash
# Start PostgreSQL and Redis
docker compose -f docker/compose.yml up -d

# Run database migrations
pnpm db:push

# Seed initial admin
pnpm db:seed
```

Default admin credentials:
- Email: `admin@example.com`
- Password: `admin123`

**IMPORTANT:** Change password after first login!

### 4. Start Panel

```bash
pnpm dev
```

Panel will be available at http://localhost:3000

### 5. Add Your First Node

1. Login to panel
2. Go to Nodes → Add Node
3. Enter name and host
4. Copy install command
5. Run on VPN server

### 6. Install Agent on VPN Server

```bash
# SSH into your VPN server as root
ssh root@your-vpn-server

# Run the install command (from panel)
curl -fsSL https://your-panel.com/install-agent.sh | \
  AGENT_TOKEN=<token> PANEL_URL=https://your-panel.com bash
```

### 7. Install OpenVPN (Optional)

If the node doesn't have OpenVPN installed:

1. Go to Node Details in panel
2. Click "Install OpenVPN"
3. Wait for job to complete
4. First client created automatically

## Development

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Seed data
pnpm db:seed

# Start panel + worker
pnpm dev

# Start individually
pnpm --filter @ovpn/panel dev
pnpm --filter @ovpn/worker dev
```

## Production

### Docker Compose

```bash
# Build and start all services
docker compose -f docker/compose.yml up -d

# View logs
docker compose -f docker/compose.yml logs -f

# Stop services
docker compose -f docker/compose.yml down
```

### Manual Build

```bash
# Build all packages
pnpm build

# Start panel
cd apps/panel && pnpm start

# Start worker
cd apps/worker && pnpm start
```

## VPN Server Requirements

- Ubuntu 22.04 or 24.04
- Root access
- Port 443/UDP open in firewall
- At least 512MB RAM
- 1GB disk space minimum

## Troubleshooting

### Agent won't connect

```bash
# Check agent status on VPN server
systemctl status ovpn-agent

# View agent logs
journalctl -u ovpn-agent -f

# Test panel connectivity
curl -v https://your-panel.com/api/agent/status
```

### OpenVPN won't start

```bash
# Check status
systemctl status openvpn-xor

# View logs
tail -f /var/log/openvpn-xor.log

# Check config
/usr/local/sbin/openvpn-xor --config /etc/openvpn/xor/server.conf --verb 7
```

### Database issues

```bash
# Reset database
pnpm db:push --force-reset

# Re-seed
pnpm db:seed
```

## Security Notes

1. **Change default password** immediately after first login
2. **Use HTTPS** in production
3. **Restrict firewall** to necessary ports only
4. **Use strong JWT_SECRET** (32+ characters)
5. **Backup database** regularly
6. **Rotate registration tokens** periodically

## Client Setup

Downloaded .ovpn files work with:
- OpenVPN for Android
- OpenVPN Connect (iOS)
- Viscosity (macOS)
- OpenVPN GUI (Windows)

**Important:** Client must support XOR/scramble patch.
