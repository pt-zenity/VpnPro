#!/usr/bin/env bash
set -euo pipefail

# OpenVPN Admin Agent Installer
# Usage: curl -fsSL https://panel.example.com/install.sh | AGENT_TOKEN=<token> bash

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

AGENT_TOKEN="${AGENT_TOKEN:-}"
PANEL_URL="${PANEL_URL:-https://panel.example.com}"

if [[ -z "$AGENT_TOKEN" ]]; then
  echo "ERROR: AGENT_TOKEN environment variable is required"
  echo "Usage: curl -fsSL https://panel.example.com/install.sh | AGENT_TOKEN=<token> bash"
  exit 1
fi

echo "=== OpenVPN Admin Agent Installer ==="
echo "Panel URL: $PANEL_URL"
echo

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  armv7l)  ARCH="armv7" ;;
  *)
    echo "ERROR: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "Detected architecture: $ARCH"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

echo "Node.js version: $(node --version)"

# Create agent directory
AGENT_DIR="/opt/ovpn-agent"
mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

# Download agent binary (or build from source)
# For MVP, we'll create a minimal agent inline

cat > "$AGENT_DIR/package.json" <<'EOF'
{
  "name": "ovpn-agent",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "axios": "^1.7.9"
  }
}
EOF

npm install --production

# Create agent entry point
cat > "$AGENT_DIR/agent.js" <<'EOF'
const axios = require('axios');

const PANEL_URL = process.env.PANEL_URL;
const AGENT_TOKEN = process.env.AGENT_TOKEN;
const HEARTBEAT_INTERVAL = 30; // seconds

const api = axios.create({
  baseURL: PANEL_URL,
  headers: {
    'Authorization': `Bearer ${AGENT_TOKEN}`,
    'User-Agent': 'ovpn-agent/1.0.0',
  },
  timeout: 30000,
});

let nodeId = null;

async function register() {
  try {
    const response = await api.post('/api/agent/register', {
      token: AGENT_TOKEN,
      agentVersion: '1.0.0',
      systemInfo: {
        os: require('os').type(),
        kernel: process.version,
        arch: process.arch,
      },
    });

    if (response.data.success) {
      nodeId = response.data.node.id;
      console.log('Registered as node:', nodeId);
      return nodeId;
    }
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('Node already registered');
    } else {
      console.error('Registration failed:', error.response?.data || error.message);
      throw error;
    }
  }
}

async function getOpenVpnStatus() {
  const { execSync } = require('child_process');

  try {
    const active = execSync('systemctl is-active openvpn-xor', { encoding: 'utf-8' }).trim() === 'active';

    if (!active) {
      return { openvpn: 'STOPPED', connectedClients: 0, uptime: 0, port: 443, protocol: 'udp' };
    }

    const statusFile = execSync('cat /var/log/openvpn-xor-status.log', { encoding: 'utf-8' });
    const clientMatch = statusFile.match(/n_clients=(\d+)/);
    const connectedClients = clientMatch ? parseInt(clientMatch[1], 10) : 0;

    const uptimeOutput = execSync('systemctl show openvpn-xor --property=ExecMainStartTimestamp', { encoding: 'utf-8' });
    const startTimeMatch = uptimeOutput.match(/ExecMainStartTimestamp=(.+)/);
    let uptime = 0;
    if (startTimeMatch?.[1]) {
      const startTime = new Date(startTimeMatch[1]);
      uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
    }

    return { openvpn: 'RUNNING', connectedClients, uptime, port: 443, protocol: 'udp' };
  } catch (error) {
    return { openvpn: 'ERROR', connectedClients: 0, uptime: 0, port: 443, protocol: 'udp' };
  }
}

async function heartbeat() {
  try {
    const status = await getOpenVpnStatus();

    const response = await api.post('/api/agent/heartbeat', {
      nodeId,
      status: status.openvpn,
      details: { connectedClients: status.connectedClients, uptime: status.uptime },
    });

    if (response.data.success && response.data.pendingJobs) {
      for (const job of response.data.pendingJobs) {
        console.log('Processing job:', job.type, job.id);
        // Job processing would be here
      }
    }
  } catch (error) {
    console.error('Heartbeat failed:', error.response?.data || error.message);
  }
}

async function start() {
  console.log('Starting agent...');
  nodeId = await register();

  // Heartbeat loop
  setInterval(heartbeat, HEARTBEAT_INTERVAL * 1000);
  heartbeat(); // First heartbeat
}

start().catch(console.error);
EOF

# Create systemd service
cat > /etc/systemd/system/ovpn-agent.service <<EOF
[Unit]
Description=OpenVPN Admin Agent
After=network-online.target openvpn-xor.service
Requires=openvpn-xor.service

[Service]
Type=simple
WorkingDirectory=$AGENT_DIR
ExecStart=/usr/bin/node $AGENT_DIR/agent.js
Environment=PANEL_URL=$PANEL_URL
Environment=AGENT_TOKEN=$AGENT_TOKEN
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create environment file
cat > "$AGENT_DIR/.env" <<EOF
PANEL_URL=$PANEL_URL
AGENT_TOKEN=$AGENT_TOKEN
EOF

chmod 600 "$AGENT_DIR/.env"

echo "=== Enabling and starting agent ==="
systemctl daemon-reload
systemctl enable ovpn-agent
systemctl restart ovpn-agent

sleep 2

if systemctl is-active --quiet ovpn-agent; then
  echo "=== Agent installed and running ==="
  echo "Check status: systemctl status ovpn-agent"
  echo "View logs: journalctl -u ovpn-agent -f"
else
  echo "ERROR: Agent failed to start"
  echo "Check logs: journalctl -u ovpn-agent -n 50"
  exit 1
fi
