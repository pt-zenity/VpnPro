import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PANEL_URL: process.env.PANEL_URL || 'https://panel.example.com',
  AGENT_TOKEN: process.env.AGENT_TOKEN || '',
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL || '30', 10),
  NODE_ID: process.env.AGENT_NODE_ID,
} as const;

if (!config.AGENT_TOKEN) {
  throw new Error('AGENT_TOKEN is required');
}
