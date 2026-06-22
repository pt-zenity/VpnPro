import { NextRequest, NextResponse } from 'next/server';

// GET /api/agent/install.sh - Return agent installation script
export async function GET(request: NextRequest) {
  const script = `#!/bin/bash
# OpenVPN XOR Agent Installation Script
# This script downloads and installs the OpenVPN XOR agent

set -e

# Configuration
AGENT_TOKEN="\${AGENT_TOKEN:?Error: AGENT_TOKEN environment variable required}"
PANEL_URL="\${PANEL_URL:-http://localhost:3000}"

echo "Installing OpenVPN XOR Agent..."
echo "Panel URL: \$PANEL_URL"
echo "Token: \${AGENT_TOKEN:0:8}..."

# Create temporary directory
TMP_DIR=\$(mktemp -d)
cd "\$TMP_DIR"

# Download agent binary (placeholder - in production, download from your server)
echo "Downloading agent..."
# AGENT_URL="\$PANEL_URL/agent/downloads/agent-\$(uname -s)-\$(uname -m)"
# curl -fsSL "\$AGENT_URL" -o agent
# chmod +x agent

# For MVP: Create a simple placeholder script
cat > agent << 'EOF'
#!/bin/bash
# Placeholder agent - in production, this would be a compiled binary

NODE_ID=""
API_TOKEN=""
INTERVAL=30

# Register with panel
register() {
    local response=\$(curl -s -X POST "\$PANEL_URL/api/agent/register" \\
        -H "Content-Type: application/json" \\
        -d '{
            "token": "\$AGENT_TOKEN",
            "agentVersion": "1.0.0",
            "systemInfo": {
                "os": "'\$(uname -s)'",
                "kernel": "'\$(uname -r)'",
                "arch": "'\$(uname -m)'"
            }
        }')

    NODE_ID=\$(echo "\$response" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    API_TOKEN=\$(echo "\$response" | grep -o '"apiToken":"[^"]*' | cut -d'"' -f4)

    if [ -z "\$NODE_ID" ]; then
        echo "Registration failed: \$response"
        exit 1
    fi

    echo "Registered successfully. Node ID: \$NODE_ID"
}

# Heartbeat loop
heartbeat() {
    while true; do
        curl -s -X POST "\$PANEL_URL/api/agent/heartbeat" \\
            -H "Authorization: Bearer \$API_TOKEN" \\
            -H "Content-Type: application/json" \\
            -d '{
                "nodeId": "\$NODE_ID",
                "status": "RUNNING",
                "details": {
                    "connectedClients": 0,
                    "cpu": 10.0,
                    "memory": 50.0
                }
            }' > /dev/null

        sleep \$INTERVAL
    done
}

# Main
register
heartbeat
EOF

chmod +x agent

# Install as system service
echo "Installing agent service..."
sudo tee /etc/systemd/system/openvpn-agent.service > /dev/null <<EOF
[Unit]
Description=OpenVPN XOR Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDir=/opt/openvpn-agent
ExecStart=/opt/openvpn-agent/agent
Restart=always
Environment="AGENT_TOKEN=$AGENT_TOKEN"
Environment="PANEL_URL=$PANEL_URL"

[Install]
WantedBy=multi-user.target
EOF

# Create installation directory
sudo mkdir -p /opt/openvpn-agent
sudo mv agent /opt/openvpn-agent/

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable openvpn-agent
sudo systemctl start openvpn-agent

echo "Agent installed and started!"
echo "Logs: sudo journalctl -u openvpn-agent -f"

# Cleanup
cd /
rm -rf "\$TMP_DIR"
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
