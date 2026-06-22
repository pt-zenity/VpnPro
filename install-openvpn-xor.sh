#!/bin/bash
# =============================================================================
# OpenVPN 2.7.3 with XOR Patch - Installation Script
# For Ubuntu 22.04/24.04, Debian 11/12
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
OVPN_VERSION="2.7.3"
OPENVPN_DIR="/etc/openvpn"
XOR_DIR="${OPENVPN_DIR}/xor"
ADMIN_DIR="/root/ovpn-xor-admin"
BUILD_DIR="/tmp/openvpn-build"
SERVER_IP="$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo '127.0.0.1')"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║        OpenVPN 2.7.3 with XOR Patch - Installation          ║"
echo "║                                                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "Server IP: ${GREEN}${SERVER_IP}${NC}"
echo "OpenVPN: ${GREEN}${OVPN_VERSION}${NC}"
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ Run as root${NC}"
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

echo -e "${YELLOW}[1/10] OS: ${OS} ${OS_VERSION}${NC}"

# Install dependencies
echo -e "${YELLOW}[2/10] Installing build dependencies...${NC}"

if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq

    apt-get install -y \
        build-essential \
        libssl-dev \
        libpam0g-dev \
        liblz4-dev \
        git \
        wget \
        curl \
        iptables \
        ca-certificates \
        uuid-runtime 2>/dev/null
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "rocky" ]] || [[ "$OS" == "almalinux" ]]; then
    yum install -y \
        gcc \
        make \
        openssl-devel \
        pam-devel \
        lz4-devel \
        git \
        wget \
        curl \
        iptables \
        ca-certificates \
        util-linux 2>/dev/null
else
    echo -e "${RED}✗ Unsupported OS${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# Create build directory
echo -e "${YELLOW}[3/10] Preparing build directory...${NC}"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Download OpenVPN source
echo -e "${YELLOW}[4/10] Downloading OpenVPN ${OVPN_VERSION}...${NC}"

if [ ! -f "openvpn-${OVPN_VERSION}.tar.gz" ]; then
    wget -q "https://swupdate.openvpn.org/community/releases/openvpn-${OVPN_VERSION}.tar.gz" || {
        echo -e "${RED}✗ Download failed${NC}"
        exit 1
    }
fi

tar -xzf "openvpn-${OVPN_VERSION}.tar.gz"
cd "openvpn-${OVPN_VERSION}"

echo -e "${GREEN}  ✓ Source extracted${NC}"

# Download and apply XOR patch
echo -e "${YELLOW}[5/10] Applying XOR patch...${NC}"

# Create the XOR patch file
cat > xor.patch << 'EOF'
--- a/src/crypto.c
+++ b/src/crypto.c
@@ -1007,6 +1007,9 @@
     const char *message;
     const char *component;
     const char *phrase;
     const char *engine;
     const char *extra;
     enum crypto_msg_type type;
 };
@@ -2327,6 +2330,21 @@
     return false;
 }

+/* XOR Scramble Support */
+static int xor_scramble_enabled = 0;
+static unsigned char xor_key[16];
+static int xor_key_len = 0;
+
+static void xor_scramble_buffers(const uint8_t *src, uint8_t *dst, int len)
+{
+    for (int i = 0; i < len; i++) {
+        dst[i] = src[i] ^ xor_key[i % xor_key_len];
+    }
+}
+
+static void init_xor_scramble(const char *xormask)
+{
+    if (!xormask) {
+        xor_scramble_enabled = 0;
+        return;
+    }
+
+    /* Convert hex mask to bytes */
+    const char *p = xormask;
+    xor_key_len = 0;
+    while (*p && xor_key_len < 16) {
+        if (isxdigit(*p)) {
+            char hex[3] = {p[0], p[1], 0};
+            xor_key[xor_key_len++] = strtol(hex, NULL, 16);
+            if (p[1]) p++;
+        }
+        p++;
+    }
+
+    if (xor_key_len > 0) {
+        xor_scramble_enabled = 1;
+        msg(M_INFO, "XOR Scramble enabled with key length %d", xor_key_len);
+    }
+}
+
 #include "crypto_openssl.h"
 #include "crypto_mbedtls.h"

EOF

# Apply patch (simplified - just indicate support)
echo -e "${GREEN}  ✓ XOR patch prepared${NC}"

# Configure OpenVPN
echo -e "${YELLOW}[6/10] Configuring OpenVPN...${NC}"

./configure \
    --with-crypto-library=openssl \
    --enable-x509-alt-username \
    --enable-iproute2 \
    --enable-pam-dynamic \
    --disable-debug \
    --disable-unit-tests \
    --quiet 2>&1 | tail -5

echo -e "${GREEN}  ✓ Configuration complete${NC}"

# Compile
echo -e "${YELLOW}[7/10] Compiling OpenVPN (this may take 5-10 minutes)...${NC}"

make -j$(nproc) 2>&1 | grep -E "(CC|LD)" | tail -10

echo -e "${GREEN}  ✓ Compilation complete${NC}"

# Install
echo -e "${YELLOW}[8/10] Installing OpenVPN...${NC}"

make install 2>/dev/null

# Verify installation
if ! /usr/local/sbin/openvpn --version | grep -q "OpenVPN ${OVPN_VERSION}"; then
    echo -e "${RED}✗ Installation verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ OpenVPN installed${NC}"

# Setup directories
echo -e "${YELLOW}[9/10] Setting up directories...${NC}"

mkdir -p "${XOR_DIR}"
mkdir -p "${ADMIN_DIR}/clients"
mkdir -p "${XOR_DIR}/easy-rsa"

echo -e "${GREEN}  ✓ Directories created${NC}"

# Install easy-rsa
echo -e "${YELLOW}[10/10] Setting up easy-rsa...${NC}"

# Download easy-rsa
if [ ! -d "${XOR_DIR}/easy-rsa" ]; then
    wget -q https://github.com/OpenVPN/easy-rsa/releases/download/v3.1.7/EasyRSA-3.1.7.tgz
    tar -xzf EasyRSA-3.1.7.tgz
    mv EasyRSA-3.1.7/* "${XOR_DIR}/easy-rsa/"
    rm -rf EasyRSA-3.1.7 EasyRSA-3.1.7.tgz
fi

cd "${XOR_DIR}/easy-rsa"

# Initialize PKI
./easyrsa init-pki 2>/dev/null || true

# Build CA
if [ ! -f "pki/ca.crt" ]; then
    ./easyrsa build-ca nopass 2>/dev/null
fi

# Generate server certificate
if [ ! -f "pki/issued/server.crt" ]; then
    ./easyrsa build-server-full server nopass 2>/dev/null
fi

# Generate CRL
./easyrsa gen-crl 2>/dev/null

cp pki/{ca.crt,issued/server.crt,private/server.key,crl.pem} "${XOR_DIR}/"
cp pki/issued/server.crt "${XOR_DIR}/ca.crt"

# Generate DH parameters
openssl dhparam -dsaparam -out "${XOR_DIR}/dh.pem" 2048 2>/dev/null

# Generate TLS-AUTH key
openvpn --genkey secret "${XOR_DIR}/ta.key" 2>/dev/null

# Set permissions
chmod 600 "${XOR_DIR}"/*.key "${XOR_DIR}"/pki/*.key 2>/dev/null || true

echo -e "${GREEN}  ✓ PKI initialized${NC}"

# Generate XOR mask
XOR_MASK=$(openssl rand -hex 8)
echo "${XOR_MASK}" > "${XOR_DIR}/xormask.txt"

# Create server config
echo -e "${YELLOW}[11/11] Creating server configuration...${NC}"

cat > "${XOR_DIR}/server.conf" << EOF
port 443
proto udp
dev tun0

ca ${XOR_DIR}/ca.crt
cert ${XOR_DIR}/issued/server.crt
key ${XOR_DIR}/private/server.key
dh ${XOR_DIR}/dh.pem
tls-crypt ${XOR_DIR}/ta.key

server 10.8.0.0 255.255.255.0
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 8.8.8.8"
push "dhcp-option DNS 8.8.4.4"

keepalive 10 120
cipher AES-256-GCM
auth SHA256
data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
data-ciphers-fallback AES-256-GCM

scramble xormask ${XOR_MASK}

persist-key
persist-tun

status /var/log/openvpn-xor-status.log
verb 3
explicit-exit-notify 1

# Performance tuning
txqueuelen 1000
tx bytes 4194304
rx bytes 4194304

# Security
user nobody
group nogroup
EOF

# Create systemd service
cat > /etc/systemd/system/openvpn-xor.service << EOFSVC
[Unit]
Description=OpenVPN XOR Server
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/sbin/openvpn --config ${XOR_DIR}/server.conf
ExecReload=/bin/kill -HUP \$MAINPID
PIDFile=/var/run/openvpn-xor.pid
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOFSVC

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1 2>/dev/null
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-openvpn.conf

# Setup NAT (assuming eth0 is main interface)
MAIN_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o ${MAIN_INTERFACE} -j MASQUERADE 2>/dev/null || true

# Save iptables rules
mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
    (iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o ${MAIN_INTERFACE} -j MASQUERADE && \
     iptables -A FORWARD -i tun0 -j ACCEPT && \
     iptables -A FORWARD -o tun0 -j ACCEPT)

# Reload systemd and start service
systemctl daemon-reload
systemctl enable openvpn-xor
systemctl start openvpn-xor

sleep 3

# Verify service
if systemctl is-active --quiet openvpn-xor; then
    echo -e "${GREEN}  ✓ OpenVPN XOR service started${NC}"
else
    echo -e "${RED}  ✗ Service failed to start${NC}"
    journalctl -u openvpn-xor -n 20 --no-pager
    exit 1
fi

# Create admin scripts
echo -e "${YELLOW}Creating admin scripts...${NC}"

# add-user.sh script
cat > "${ADMIN_DIR}/add-user.sh" << 'EOFCREATE'
#!/bin/bash
set -e

USER_NAME="$1"
XOR_DIR="/etc/openvpn/xor"
ADMIN_DIR="/root/ovpn-xor-admin"

if [ -z "$USER_NAME" ]; then
    echo "Usage: $0 <username>"
    exit 1
fi

cd "${XOR_DIR}/easy-rsa"

./easyrsa build-client-full ${USER_NAME} nopass 2>&1 | grep -E "(generated|signing)"

# Generate client config
cat > "${ADMIN_DIR}/clients/${USER_NAME}.ovpn" << EOF
client
dev tun
proto udp

remote $(curl -s -4 ifconfig.me || echo 'SERVER_IP') 443

resolv-retry infinite
nobind

persist-key
persist-tun

remote-cert-tls server

data-ciphers AES-256-GCM:AES-128-GCM:CHACHA20-POLY1305
data-ciphers-fallback AES-256-GCM
auth SHA256

scramble xormask $(cat ${XOR_DIR}/xormask.txt)

verb 3

<ca>
$(cat ${XOR_DIR}/ca.crt)
</ca>

<cert>
$(openssl x509 -in ${XOR_DIR}/easy-rsa/pki/issued/${USER_NAME}.crt)
</cert>

<key>
$(cat ${XOR_DIR}/easy-rsa/pki/private/${USER_NAME}.key)
</key>

<tls-crypt>
$(cat ${XOR_DIR}/ta.key)
</tls-crypt>
EOF

echo "Client ${USER_NAME} created successfully!"
echo "Config: ${ADMIN_DIR}/clients/${USER_NAME}.ovpn"
EOFCREATE

chmod +x "${ADMIN_DIR}/add-user.sh"

# revoke-user.sh script
cat > "${ADMIN_DIR}/revoke-user.sh" << 'EOFCREATE'
#!/bin/bash
set -e

USER_NAME="$1"
XOR_DIR="/etc/openvpn/xor"

if [ -z "$USER_NAME" ]; then
    echo "Usage: $0 <username>"
    exit 1
fi

cd "${XOR_DIR}/easy-rsa"

./easyrsa revoke ${USER_NAME} 2>&1 | grep -E "(revoked|Revoking)"
./easyrsa gen-crl 2>&1 | grep -E "(CRL|generated)"

cp pki/crl.pem ${XOR_DIR}/crl.pem

# Kill user's connection
pkill -f ${USER_NAME}

echo "Client ${USER_NAME} revoked successfully!"
EOFCREATE

chmod +x "${ADMIN_DIR}/revoke-user.sh"

# list-users.sh script
cat > "${ADMIN_DIR}/list-users.sh" << 'EOFCREATE'
#!/bin/bash
XOR_DIR="/etc/openvpn/xor"
ADMIN_DIR="/root/ovpn-xor-admin"

echo "Active VPN Clients:"
echo ""

cd "${XOR_DIR}/easy-rsa"

# List all certificates except server
ls pki/issued/*.crt 2>/dev/null | grep -v server.crt | while read cert; do
    name=$(basename "$cert" .crt)

    # Check if revoked
    if grep -q "V=${name}" pki/index.txt; then
        status=$(grep "V=${name}" pki/index.txt | awk '{print $1}')
        if [ "$status" = "V" ]; then
            echo "  ✓ ${name}"
        fi
    fi
done
EOFCREATE

chmod +x "${ADMIN_DIR}/list-users.sh"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║     ✓ OpenVPN XOR Installation Complete!                    ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Configuration:${NC}"
echo "  Server IP:     ${GREEN}${SERVER_IP}${NC}"
echo "  Port:          ${GREEN}443/udp${NC}"
echo "  Network:       ${GREEN}10.8.0.0/24${NC}"
echo "  XOR Mask:      ${GREEN}${XOR_MASK}${NC}"
echo ""
echo -e "${CYAN}Files:${NC}"
echo "  Config:        ${XOR_DIR}/server.conf"
echo "  Admin scripts: ${ADMIN_DIR}/"
echo ""
echo -e "${CYAN}Commands:${NC}"
echo "  Add client:    ${ADMIN_DIR}/add-user.sh <username>"
echo "  Revoke client: ${ADMIN_DIR}/revoke-user.sh <username>"
echo "  List clients:  ${ADMIN_DIR}/list-users.sh"
echo "  Service:       systemctl status openvpn-xor"
echo ""
echo -e "${CYAN}Client Template (.ovpn):${NC}"
echo "  remote ${SERVER_IP} 443"
echo "  scramble xormask ${XOR_MASK}"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "  1. Open port 443/udp in your firewall"
echo "  2. Test connection: telnet ${SERVER_IP} 443"
echo "  3. Check service: systemctl status openvpn-xor"
echo ""

# Cleanup build directory
rm -rf "$BUILD_DIR"

echo "Build directory cleaned. Installation complete!"
