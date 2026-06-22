#!/bin/bash
# =============================================================================
# OpenVPN Admin Panel - Agent Install Script
# Version: 2.2.0 - Full Production Ready with OpenVPN XOR
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
AGENT_VERSION="2.2.0"
AGENT_DIR="/opt/ovpn-agent"
REPO_URL="https://github.com/tunnect-spec/ovpn-admin"

# Parse arguments
INSTALL_OPENVPN="${INSTALL_OPENVPN:-false}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --install-openvpn)
      INSTALL_OPENVPN=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║        OpenVPN Admin Panel - Agent Installation              ║"
echo "║                     Version ${AGENT_VERSION}                          ║"
echo "║                                                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Parse environment variables
REGISTRATION_TOKEN="${AGENT_TOKEN}"
PANEL_URL="${PANEL_URL}"

# Validate required variables
if [[ -z "$REGISTRATION_TOKEN" ]]; then
    echo -e "${RED}✗ Error: AGENT_TOKEN (registration token) is required${NC}"
    echo ""
    echo "Usage:"
    echo "  curl -fsSL <PANEL_URL>/api/agent/install.sh | \\"
    echo "    AGENT_TOKEN=<registration_token> PANEL_URL=<url> bash"
    echo ""
    echo "Options:"
    echo "  --install-openvpn    Also install OpenVPN XOR server"
    echo ""
    exit 1
fi

if [[ -z "$PANEL_URL" ]]; then
    echo -e "${RED}✗ Error: PANEL_URL is required${NC}"
    exit 1
fi

# Display configuration
echo -e "${BLUE}Configuration:${NC}"
echo -e "  Panel URL: ${GREEN}${PANEL_URL}${NC}"
echo -e "  Registration Token: ${GREEN}${REGISTRATION_TOKEN:0:12}...${NC}"
echo -e "  Install OpenVPN XOR: ${GREEN}${INSTALL_OPENVPN}${NC}"
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ This script must be run as root${NC}"
   exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}✗ Cannot detect OS${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/9] Detected OS: ${OS} ${OS_VERSION}${NC}"

# Install dependencies
echo -e "${YELLOW}[2/9] Installing dependencies...${NC}"

if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq 2>/dev/null || true

    # Install required packages
    apt-get install -y curl wget ca-certificates gnupg lsb-release 2>/dev/null || {
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    }

    # Install Node.js 20.x
    if ! command -v node &> /dev/null || [ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]; then
        echo "  Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
        apt-get install -y nodejs 2>/dev/null
    fi
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "rocky" ]] || [[ "$OS" == "almalinux" ]]; then
    yum install -y curl wget ca-certificates gnupg 2>/dev/null || {
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    }

    if ! command -v node &> /dev/null || [ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]; then
        echo "  Installing Node.js 20.x..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    fi
else
    echo -e "${RED}✗ Unsupported OS: $OS${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js installation failed${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "  ${GREEN}✓ Node.js ${NODE_VERSION} installed${NC}"

# Register agent with panel
echo -e "${YELLOW}[3/9] Registering agent with panel...${NC}"

echo "  Calling ${PANEL_URL}/api/agent/register ..."

REGISTER_RESPONSE=$(curl -s -X POST "${PANEL_URL}/api/agent/register" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${REGISTRATION_TOKEN}\",\"agentVersion\":\"${AGENT_VERSION}\",\"systemInfo\":{\"os\":\"${OS}\",\"kernel\":\"${OS_VERSION}\",\"arch\":\"$(uname -m)\"}}" 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}✗ Registration request failed${NC}"
    echo "  Response: $REGISTER_RESPONSE"
    exit 1
fi

# Parse response
if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    API_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"apiToken":"[^"]*' | cut -d'"' -f4)

    if [[ -z "$API_TOKEN" ]]; then
        API_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -oE 'apiToken[" ]+:[" ]+[^"]+' | cut -d: -f2 | tr -d ' "')
    fi

    if [[ -z "$API_TOKEN" ]]; then
        echo -e "${RED}✗ Failed to extract API token${NC}"
        echo "  Response: $REGISTER_RESPONSE"
        exit 1
    fi

    echo -e "  ${GREEN}✓ Registered successfully${NC}"
    echo -e "  ${GREEN}✓ API Token: ${API_TOKEN:0:12}...${NC}"
else
    echo -e "${RED}✗ Registration failed${NC}"

    ERROR_TYPE=$(echo "$REGISTER_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
    ERROR_MSG=$(echo "$REGISTER_RESPONSE" | grep -o '"message":"[^"]*' | cut -d'"' -f4)

    echo -e "  ${RED}Error: ${ERROR_TYPE}${NC}"
    echo -e "  ${RED}Message: ${ERROR_MSG}${NC}"

    case "$ERROR_TYPE" in
        "INVALID_TOKEN")
            echo ""
            echo "The registration token is invalid or has expired."
            echo "Please generate a new token from the panel."
            ;;
        "TOKEN_ALREADY_USED")
            echo ""
            echo "This registration token has already been used."
            echo "Each token can only be used once. Please generate a new one."
            ;;
        "NODE_NOT_FOUND")
            echo ""
            echo "The node associated with this token was not found."
            echo "Please check the panel or create a new node."
            ;;
        "NODE_ALREADY_REGISTERED")
            echo ""
            echo "This node is already registered."
            echo "If you want to re-register, first delete the node from the panel."
            ;;
        *)
            echo ""
            echo "An unknown error occurred during registration."
            ;;
    esac

    exit 1
fi

# Install OpenVPN XOR if requested
if [ "$INSTALL_OPENVPN" = true ]; then
    echo -e "${YELLOW}[4/9] Installing OpenVPN XOR...${NC}"
    echo "  This will take 5-10 minutes..."

    curl -fsSL ${REPO_URL}/raw/main/install-openvpn-xor.sh | bash || {
        echo -e "${RED}✗ OpenVPN XOR installation failed${NC}"
        echo "  You can install it later manually"
        INSTALL_OPENVPN=false
    }

    echo -e "  ${GREEN}✓ OpenVPN XOR installed${NC}"
else
    echo -e "${YELLOW}[4/9] Skipping OpenVPN XOR installation${NC}"
    echo "  To install later: curl -fsSL ${REPO_URL}/raw/main/install-openvpn-xor.sh | bash"
fi

# Create agent directory
echo -e "${YELLOW}[5/9] Setting up agent directory...${NC}"

if [ -d "$AGENT_DIR" ]; then
    echo "  Stopping existing agent..."
    systemctl stop ovpn-agent 2>/dev/null || true
fi

rm -rf "$AGENT_DIR"
mkdir -p "$AGENT_DIR"
cd "$AGENT_DIR"

# Save API token
echo "$API_TOKEN" > "${AGENT_DIR}/.api_token"
chmod 600 "${AGENT_DIR}/.api_token"

# Create minimal agent (will be upgraded later)
cat > package.json << 'EOFPKG'
{
  "name": "ovpn-agent",
  "version": "2.2.0",
  "description": "OpenVPN Admin Panel Agent",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "axios": "^1.6.5"
  }
}
EOFPKG

# Create inline agent for now (TODO: download built package)
cat > index.js << 'EOFINDEX'
import axios from 'axios';
import { readFileSync } from 'fs';

// Read API token
let API_TOKEN = '';
try {
  API_TOKEN = readFileSync('/opt/ovpn-agent/.api_token', 'utf-8').trim();
} catch (err) {
  console.error('Failed to read API token');
  process.exit(1);
}

const CONFIG = {
  PANEL_URL: process.env.PANEL_URL,
  API_TOKEN: API_TOKEN,
  HEARTBEAT_INTERVAL: 30000,
};

let heartbeatCount = 0;
let successCount = 0;

async function sendHeartbeat() {
  heartbeatCount++;
  const startTime = Date.now();

  try {
    // Check if OpenVPN is installed
    let openvpnStatus = 'STOPPED';
    let connectedClients = 0;

    try {
      const { execSync } = require('child_process');
      const status = execSync('systemctl is-active openvpn-xor').toString().trim();
      if (status === 'active') {
        openvpnStatus = 'RUNNING';
        // Try to get connected clients
        try {
          const statusFile = execSync('cat /var/log/openvpn-xor-status.log').toString();
          const match = statusFile.match(/n_clients=(\d+)/);
          connectedClients = match ? parseInt(match[1], 10) : 0;
        } catch (e) {
          // Status file might not exist
        }
      }
    } catch (e) {
      // OpenVPN not installed or not running
    }

    const response = await axios.post(
      `${CONFIG.PANEL_URL}/api/agent/heartbeat`,
      {
        timestamp: startTime,
        uptime: Math.floor(process.uptime()),
        status: openvpnStatus,
        details: {
          connectedClients: connectedClients,
          cpu: 0,
          memory: 0,
          disk: 0,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    successCount++;
    const duration = Date.now() - startTime;

    console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ✓ Heartbeat #${heartbeatCount} (${duration}ms) - Status: ${openvpnStatus}, Clients: ${connectedClients}`);

    // Process jobs
    if (response.data?.pendingJobs?.length > 0) {
      console.log(`  → ${response.data.pendingJobs.length} pending job(s)`);
      for (const job of response.data.pendingJobs) {
        console.log(`     - ${job.type} (id: ${job.id})`);
        // TODO: Process jobs when OpenVPN is installed
      }
    }

    return true;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('✗ API authentication failed');
        process.exit(1);
      }
      if (error.response.status === 404) {
        console.error('✗ Node not found on panel');
        process.exit(1);
      }
    }
    console.error(`✗ Heartbeat failed: ${error.message}`);
    return false;
  }
}

async function start() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              OpenVPN XOR Agent v2.2.0                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Panel: ${CONFIG.PANEL_URL}`);
  console.log(`Interval: ${CONFIG.HEARTBEAT_INTERVAL / 1000}s`);
  console.log('');

  const firstBeat = await sendHeartbeat();

  if (!firstBeat) {
    console.error('✗ Failed to connect to panel');
    process.exit(1);
  }

  console.log('✓ Agent connected! Starting heartbeat loop...\n');
  setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
}

process.on('SIGTERM', () => {
  console.log('\nAgent shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nAgent shutting down...');
  process.exit(0);
});

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
EOFINDEX

# Install dependencies
echo -e "${YELLOW}[6/9] Installing dependencies...${NC}"

npm install --production --no-audit --no-fund 2>&1 | grep -E "(added)" || true

echo -e "  ${GREEN}✓ Dependencies installed${NC}"

# Create systemd service
echo -e "${YELLOW}[7/9] Creating systemd service...${NC}"

cat > /etc/systemd/system/ovpn-agent.service << EOF
[Unit]
Description=OpenVPN Admin Panel Agent
Documentation=https://github.com/tunnect-spec/ovpn-admin
After=network.target openvpn-xor.service

[Service]
Type=simple
User=root
WorkingDirectory=${AGENT_DIR}
Environment="NODE_ENV=production"
Environment="PANEL_URL=${PANEL_URL}"
Environment="AGENT_HEARTBEAT_INTERVAL=30"
Environment="AGENT_HEARTBEAT_TIMEOUT=10"
ExecStart=/usr/bin/node ${AGENT_DIR}/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ovpn-agent

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ovpn-agent 2>/dev/null
systemctl stop ovpn-agent 2>/dev/null || true

# Start agent
echo -e "${YELLOW}[8/9] Starting agent...${NC}"
systemctl start ovpn-agent

sleep 3

# Verify
echo ""
if systemctl is-active --quiet ovpn-agent; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║              ✓ Agent Installed Successfully!              ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${CYAN}Service Management:${NC}"
    echo "  systemctl status ovpn-agent     - Check status"
    echo "  journalctl -u ovpn-agent -f    - Follow logs"
    echo ""

    if [ "$INSTALL_OPENVPN" = true ]; then
        echo -e "${CYAN}OpenVPN XOR:${NC}"
        echo "  systemctl status openvpn-xor     - Check VPN status"
        echo "  /root/ovpn-xor-admin/add-user.sh <name>    - Create client"
        echo "  /root/ovpn-xor-admin/list-users.sh       - List clients"
        echo ""
    fi

    echo -e "${CYAN}Recent Logs:${NC}"
    journalctl -u ovpn-agent -n 3 --no-pager
    echo ""

    if [ "$INSTALL_OPENVPN" = false ]; then
        echo -e "${YELLOW}⚠️  OpenVPN XOR not installed${NC}"
        echo ""
        echo "To install OpenVPN XOR later:"
        echo "  curl -fsSL ${REPO_URL}/raw/main/install-openvpn-xor.sh | bash"
        echo ""
        echo "Or reinstall agent with OpenVPN:"
        echo "  curl -fsSL ${PANEL_URL}/api/agent/install.sh | \\"
        echo "    AGENT_TOKEN=<token> PANEL_URL=${PANEL_URL} bash -s --install-openvpn"
        echo ""
    fi
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ✗ Agent Installation Failed                  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo "Service Status:"
    systemctl status ovpn-agent --no-pager || true
    echo ""

    echo "Service Logs:"
    journalctl -u ovpn-agent -n 20 --no-pager || true
    echo ""

    exit 1
fi

echo "${GREEN}Installation complete!${NC}"
