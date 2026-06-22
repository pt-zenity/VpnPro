import { Agent } from './agent';
import { config } from './config';

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║              OpenVPN XOR Agent v3.1.0                        ║');
  console.log('║                                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Panel:    ${config.PANEL_URL}`);
  console.log(`Interval: ${config.HEARTBEAT_INTERVAL}s`);
  console.log('');

  const agent = new Agent({
    panelUrl: config.PANEL_URL,
    token: config.AGENT_TOKEN,
    heartbeatInterval: config.HEARTBEAT_INTERVAL,
  });

  await agent.start();
  console.log('Agent started successfully!');

  // Graceful shutdown
  process.on('SIGTERM', () => agent.stop());
  process.on('SIGINT', () => agent.stop());
}

main().catch((err) => {
  console.error('Failed to start agent:', err);
  process.exit(1);
});
