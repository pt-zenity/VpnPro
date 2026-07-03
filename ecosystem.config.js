module.exports = {
  apps: [
    {
      name: 'ovpn-panel',
      cwd: '/home/vpn/webapp/apps/panel',
      script: 'node',
      args: '.next/standalone/apps/panel/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        DATABASE_URL: 'postgresql://ovpn:SecureOvpnPass2024!@localhost:5432/ovpn_admin',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'jtKsR1FSzdEoD/fuE3Q/Pq5HgSQZ+aS5VGxqfH+r1KKHoZDpUTNt2C2bkiCescu',
        ENCRYPTION_KEY: '48e51b07388c9480e5baf7b9c1f886f0',
        API_TOKEN_SALT: '9bfc9fb9d07649f146ed33ca8ead6d7018d3433c3de53180',
        NEXT_PUBLIC_APP_URL: 'https://vpn.sis2.xyz',
        PANEL_URL: 'https://vpn.sis2.xyz',
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'ovpn-worker',
      cwd: '/home/vpn/webapp/apps/worker',
      script: 'node',
      args: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://ovpn:SecureOvpnPass2024!@localhost:5432/ovpn_admin',
        REDIS_URL: 'redis://localhost:6379',
      },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
