#!/bin/bash
# =============================================================================
# OpenVPN XOR - Installation Script (Executed by Agent)
# =============================================================================

set -e

# Parse arguments
USE_XOR="true"
DNS_MODE="standard"
CUSTOM_DNS=""
DOMAIN=""
MTU=1500
MSSFIX=1360

RESTORE_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --use-xor)
      USE_XOR="$2"
      shift 2
      ;;
    --dns-mode)
      DNS_MODE="$2"
      shift 2
      ;;
    --custom-dns)
      CUSTOM_DNS="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --mtu)
      MTU="$2"
      shift 2
      ;;
    --mssfix)
      MSSFIX="$2"
      shift 2
      ;;
    --restore)
      RESTORE_FILE="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

echo "Installing OpenVPN..."
echo "XOR: $USE_XOR, DNS: $DNS_MODE, Domain: $DOMAIN, MTU: $MTU, MSSFIX: $MSSFIX"

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "PROGRESS: 5: Detecting OS"
export DEBIAN_FRONTEND=noninteractive
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    echo "PROGRESS: 10: Installing build dependencies (APT)"
    apt-get update -qq
    apt-get install -y build-essential libssl-dev libpam0g-dev liblz4-dev pkg-config libcap-ng-dev libnl-genl-3-dev libnl-3-dev liblzo2-dev autoconf automake libtool iptables-persistent uuid-runtime iptables git curl wget
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "rocky" ]] || [[ "$OS" == "almalinux" ]]; then
    yum install -y gcc make openssl-devel pam-devel lz4-devel libcap-ng-devel libnl3-devel lzo-devel autoconf automake libtool git wget curl util-linux iptables
fi

BUILD_DIR="/tmp/openvpn-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "PROGRESS: 20: Downloading OpenVPN source"
# Download OpenVPN
wget -q https://github.com/OpenVPN/openvpn/archive/refs/tags/v2.7.3.tar.gz
tar -xzf v2.7.3.tar.gz

if [ "$USE_XOR" == "true" ]; then
    git clone https://github.com/luzrain/openvpn-xorpatch.git
    cd openvpn-2.7.3
    git apply ../openvpn-xorpatch/patches/v2.7.3/openvpn-xor.patch
else
    cd openvpn-2.7.3
fi

echo "PROGRESS: 30: Configuring OpenVPN"
autoreconf -i -v -f
./configure --prefix=/usr/local/openvpn-xor

echo "PROGRESS: 40: Compiling OpenVPN (This may take 3-5 minutes)"
make -j$(nproc)
echo "PROGRESS: 60: Installing OpenVPN"
make install

ln -sf /usr/local/openvpn-xor/sbin/openvpn /usr/local/sbin/openvpn-xor

echo "PROGRESS: 70: Setting up PKI and Certificates"
# Setup PKI
OVPN_DIR="/etc/openvpn/xor"
EASYRSA_DIR="$OVPN_DIR/easy-rsa"

if [ -n "$RESTORE_FILE" ] && [ -f "$RESTORE_FILE" ]; then
    echo "PROGRESS: 70: Restoring PKI from backup"
    rm -rf "$OVPN_DIR"
    mkdir -p "$OVPN_DIR"
    tar -xzf "$RESTORE_FILE" -C /
else
    echo "PROGRESS: 70: Setting up PKI and Certificates"
    rm -rf "$OVPN_DIR"
    mkdir -p "$OVPN_DIR"

    wget -qO- https://github.com/OpenVPN/easy-rsa/releases/download/v3.1.7/EasyRSA-3.1.7.tgz | tar xz -C /tmp
    mv /tmp/EasyRSA-3.1.7 "$EASYRSA_DIR"
    cd "$EASYRSA_DIR"

    cp vars.example vars
    sed -i 's/#set_var EASYRSA_ALGO .*/set_var EASYRSA_ALGO ec/g' vars
    sed -i 's/#set_var EASYRSA_CURVE .*/set_var EASYRSA_CURVE secp384r1/g' vars

    ./easyrsa init-pki
    EASYRSA_BATCH=1 ./easyrsa build-ca nopass
    EASYRSA_BATCH=1 ./easyrsa gen-req server nopass
    EASYRSA_BATCH=1 ./easyrsa sign-req server server
    ./easyrsa gen-dh
    EASYRSA_BATCH=1 ./easyrsa gen-crl >/dev/null 2>&1
    openvpn-xor --genkey tls-auth ta.key

    cp pki/ca.crt pki/private/server.key pki/issued/server.crt pki/dh.pem pki/crl.pem ta.key "$OVPN_DIR/"
    chown nobody:nogroup "$OVPN_DIR/crl.pem"

    XOR_MASK="0000000000000000"
    if [ "$USE_XOR" == "true" ]; then
        XOR_MASK=$(uuidgen | tr -d '-')
    fi
    # Save XOR Mask for Agent to read
    echo "$XOR_MASK" > /etc/openvpn/xor/xor_mask.txt

    echo "PROGRESS: 85: Generating Configs"
    # Determine Server Host (IP or Domain)
    SERVER_HOST="${DOMAIN}"
    if [[ -z "$SERVER_HOST" ]]; then
        SERVER_HOST=$(curl -s -4 ifconfig.me)
    fi

    PORT="443"

    cat > "$OVPN_DIR/server.conf" << EOFCONF
port $PORT
proto udp
dev tun

ca ca.crt
cert server.crt
key server.key
dh dh.pem
tls-auth ta.key 0
crl-verify crl.pem

topology subnet
server 10.8.0.0 255.255.255.0
ifconfig-pool-persist ipp.txt
push "redirect-gateway def1 bypass-dhcp"

keepalive 10 120
persist-key
persist-tun

status /var/log/openvpn-xor-status.log
log-append /var/log/openvpn-xor.log
verb 3

tun-mtu $MTU
mssfix $MSSFIX
EOFCONF

    if [ "$USE_XOR" == "true" ]; then
        echo "scramble xormask $XOR_MASK" >> "$OVPN_DIR/server.conf"
    fi

    if [ "$DNS_MODE" == "standard" ]; then
        echo 'push "dhcp-option DNS 8.8.8.8"' >> "$OVPN_DIR/server.conf"
        echo 'push "dhcp-option DNS 1.1.1.1"' >> "$OVPN_DIR/server.conf"
    elif [ "$DNS_MODE" == "custom" ]; then
        IFS=',' read -ra ADDR <<< "$CUSTOM_DNS"
        for i in "${ADDR[@]}"; do
            DNS_IP=$(echo $i | xargs)
            if [[ ! -z "$DNS_IP" ]]; then
                echo "push \"dhcp-option DNS $DNS_IP\"" >> "$OVPN_DIR/server.conf"
            fi
        done
    fi
fi

# Save config for clients
mkdir -p /root/ovpn-xor-admin/clients

cat > /root/ovpn-xor-admin/client-template.txt << EOFCLIENT
client
dev tun
proto udp
remote $SERVER_HOST $PORT
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
tls-auth ta.key 1
auth-nocache
verb 3
tun-mtu $MTU
mssfix $MSSFIX
EOFCLIENT

if [ "$USE_XOR" == "true" ]; then
    echo "scramble xormask $XOR_MASK" >> /root/ovpn-xor-admin/client-template.txt
fi

echo "<ca>" >> /root/ovpn-xor-admin/client-template.txt
cat $OVPN_DIR/ca.crt >> /root/ovpn-xor-admin/client-template.txt
echo "</ca>" >> /root/ovpn-xor-admin/client-template.txt

echo "<tls-auth>" >> /root/ovpn-xor-admin/client-template.txt
cat $OVPN_DIR/ta.key >> /root/ovpn-xor-admin/client-template.txt
echo "</tls-auth>" >> /root/ovpn-xor-admin/client-template.txt

cat > /root/ovpn-xor-admin/add-user.sh << 'EOFSH'
#!/bin/bash
CLIENT=$1
cd /etc/openvpn/xor/easy-rsa
EASYRSA_BATCH=1 ./easyrsa gen-req "$CLIENT" nopass >/dev/null 2>&1
EASYRSA_BATCH=1 ./easyrsa sign-req client "$CLIENT" >/dev/null 2>&1

cp /root/ovpn-xor-admin/client-template.txt "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
echo "<cert>" >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
cat "pki/issued/$CLIENT.crt" | sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
echo "</cert>" >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
echo "<key>" >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
cat "pki/private/$CLIENT.key" >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
echo "</key>" >> "/root/ovpn-xor-admin/clients/$CLIENT.ovpn"
EOFSH
chmod +x /root/ovpn-xor-admin/add-user.sh

cat > /root/ovpn-xor-admin/revoke-user.sh << 'EOFSH2'
#!/bin/bash
CLIENT=$1
cd /etc/openvpn/xor/easy-rsa
EASYRSA_BATCH=1 ./easyrsa revoke "$CLIENT" >/dev/null 2>&1
EASYRSA_BATCH=1 ./easyrsa gen-crl >/dev/null 2>&1
cp pki/crl.pem /etc/openvpn/xor/
chown nobody:nogroup /etc/openvpn/xor/crl.pem
EOFSH2
chmod +x /root/ovpn-xor-admin/revoke-user.sh

echo "PROGRESS: 95: Configuring Firewall"
# Firewall
MAIN_IF=$(ip route | grep default | sed -e "s/^.*dev.//" -e "s/.proto.*//")
iptables -t nat -A POSTROUTING -s 10.8.0.0/24 -o $MAIN_IF -j MASQUERADE
iptables -I FORWARD 1 -i tun0 -o $MAIN_IF -j ACCEPT
iptables -I FORWARD 1 -i $MAIN_IF -o tun0 -m state --state RELATED,ESTABLISHED -j ACCEPT

mkdir -p /etc/iptables
iptables-save > /etc/iptables/rules.v4
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-openvpn.conf

# Service
cat > /etc/systemd/system/openvpn-xor.service << EOFSRV
[Unit]
Description=OpenVPN XOR Daemon
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/openvpn-xor/sbin/openvpn --config /etc/openvpn/xor/server.conf
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOFSRV

systemctl daemon-reload
systemctl enable openvpn-xor
systemctl restart openvpn-xor

# Save XOR Mask for Agent to read if not exist
if [ ! -f /etc/openvpn/xor/xor_mask.txt ]; then
    echo "0000000000000000" > /etc/openvpn/xor/xor_mask.txt
fi

echo "PROGRESS: 99: Creating PKI backup"
tar -czf /root/ovpn-xor-admin/pki-backup.tar.gz -C / etc/openvpn/xor/easy-rsa/pki etc/openvpn/xor/ta.key etc/openvpn/xor/xor_mask.txt etc/openvpn/xor/server.conf etc/openvpn/xor/crl.pem

echo "PROGRESS: 100: Done"
echo "OpenVPN installation complete."
