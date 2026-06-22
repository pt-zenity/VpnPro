import { Agent } from './agent';
import { config } from './config';

async function main() {
  const agent = new Agent({
    panelUrl: config.PANEL_URL,
    token: config.AGENT_TOKEN,
    heartbeatInterval: config.HEARTBEAT_INTERVAL,
  });

  await agent.start();
  console.log('Agent started');

  // Graceful shutdown
  process.on('SIGTERM', () => agent.stop());
  process.on('SIGINT', () => agent.stop());
}

main().catch(console.error);
