#!/bin/bash
# =============================================================================
# OpenVPN Admin Panel - Quick Install (Docker Compose)
# Для быстрой установки на чистый сервер
# =============================================================================

set -e

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🚀 OpenVPN Admin Panel - Quick Install${NC}"
echo ""

# Проверка root
if [[ $EUID -ne 0 ]]; then
    echo "❌ Запустите: sudo bash $0"
    exit 1
fi

# Установка Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Устанавливаю Docker..."
    apt-get update -qq
    apt-get install -y curl ca-certificates gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y docker-ce docker-compose-plugin
    systemctl start docker
    systemctl enable docker
fi

# Генерация секретов
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | head -c 32)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | head -c 32)
DB_PASS=$(openssl rand -base64 24 | tr -d "=+")
ADMIN_PASS=$(openssl rand -base64 16 | tr -d "=+/")

# Создание директории
mkdir -p /opt/ovpn-admin
cd /opt/ovpn-admin

# Создание docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: ovpn-admin-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ovpn
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ovpn_admin
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ovpn"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - ovpn-network

  redis:
    image: redis:7-alpine
    container_name: ovpn-admin-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - ovpn-network

  panel:
    image: ovpn-admin-panel:latest
    container_name: ovpn-admin-panel
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://ovpn:${POSTGRES_PASSWORD}@postgres:5432/ovpn_admin
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
      PANEL_URL: ${PANEL_URL:-http://localhost:3000}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ovpn-network

  worker:
    image: ovpn-admin-worker:latest
    container_name: ovpn-admin-worker
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ovpn:${POSTGRES_PASSWORD}@postgres:5432/ovpn_admin
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ovpn-network

volumes:
  postgres_data:
  redis_data:

networks:
  ovpn-network:
    driver: bridge
EOF

# Создание .env
cat > .env << EOF
POSTGRES_PASSWORD=$DB_PASS
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
PANEL_URL=${PANEL_URL:-http://localhost:3000}
EOF

# Создание Dockerfile для panel
cat > Dockerfile.panel << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm --filter @ovpn/panel build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/panel/node_modules ./apps/panel/node_modules
COPY --from=builder /app/apps/panel/dist ./apps/panel/dist
COPY --from=builder /app/apps/panel/package.json ./apps/panel/
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "apps/panel/dist/server.js"]
EOF

# Создание Dockerfile для worker
cat > Dockerfile.worker << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm --filter @ovpn/worker build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
EOF

echo "🔨 Строю Docker образы..."
docker build -f Dockerfile.panel -t ovpn-admin-panel:latest .
docker build -f Dockerfile.worker -t ovpn-admin-worker:latest .

echo "🚀 Запускаю сервисы..."
docker compose up -d

echo "⏳ Ожидаю запуск баз данных..."
sleep 10

# Создание админа
echo "👤 Создаю админа..."
docker exec ovpn-admin-db psql -U ovpn -d ovpn_admin -c "
  INSERT INTO \"Admin\" (id, email, passwordHash, role, createdAt)
  VALUES (
    (select gen_random_uuid()),
    'admin@ovpn.local',
    (encode digest('${ADMIN_PASS}default_salt', 'sha256'), 'hex'),
    'SUPERADMIN',
    now()
  );
"

# Сохранение учетных данных
cat > credentials.txt << EOF
═══════════════════════════════════════
🎉 OpenVPN Admin Panel установлена!
═══════════════════════════════════════

🌐 URL:           http://$(hostname -I | awk '{print $1}'):3000
🔑 Login:         admin@ovpn.local
🔑 Password:      $ADMIN_PASS

💾 Сохраните эти данные!

Управление:
  docker compose logs -f      - логи
  docker compose restart      - перезапуск
  docker compose down         - остановить
═══════════════════════════════════════
EOF

chmod 600 credentials.txt

echo ""
echo -e "${GREEN}✅ Установка завершена!${NC}"
cat credentials.txt
echo ""
echo "⚠️  Для продакшна настроьте HTTPS (nginx + Let's Encrypt)"