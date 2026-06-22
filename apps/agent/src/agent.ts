import axios, { AxiosInstance } from 'axios';
import { IntervalScheduler } from './scheduler';
import { OpenVpnOps } from './ops';

export interface AgentConfig {
  panelUrl: string;
  token: string;
  heartbeatInterval: number;
}

export class Agent {
  private api: AxiosInstance;
  private ops: OpenVpnOps;
  private scheduler: IntervalScheduler;
  private nodeId?: string;
  private stopping = false;

  constructor(private config: AgentConfig) {
    this.api = axios.create({
      baseURL: config.panelUrl,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'User-Agent': `ovpn-agent/${this.getAgentVersion()}`,
      },
      timeout: 30000,
    });

    this.ops = new OpenVpnOps();
    this.scheduler = new IntervalScheduler(config.heartbeatInterval * 1000);
  }

  async start() {
    console.log('Starting agent...');

    // First, register if needed
    await this.register();

    // Start heartbeat loop
    this.scheduler.start(() => this.heartbeat());

    // Start job polling
    this.pollJobs();
  }

  async stop() {
    console.log('Stopping agent...');
    this.stopping = true;
    this.scheduler.stop();
    process.exit(0);
  }

  private async register() {
    try {
      // If we have a nodeId stored, skip registration
      const storedNodeId = process.env.AGENT_NODE_ID;
      if (storedNodeId) {
        this.nodeId = storedNodeId;
        console.log(`Using stored node ID: ${this.nodeId}`);
        return;
      }

      // Otherwise, this is a registration token
      const response = await this.api.post('/api/agent/register', {
        token: this.config.token,
        agentVersion: this.getAgentVersion(),
        systemInfo: this.getSystemInfo(),
      });

      if (response.data.success) {
        this.nodeId = response.data.node.id;
        console.log(`Registered as node: ${this.nodeId}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Already registered, get node info from token
        console.log('Node already registered');
      } else {
        console.error('Registration failed:', error);
        throw error;
      }
    }
  }

  private async heartbeat() {
    if (this.stopping) return;

    try {
      const status = await this.ops.getStatus();
      const details = await this.ops.getDetails();

      const response = await this.api.post('/api/agent/heartbeat', {
        nodeId: this.nodeId,
        status: status.openvpn,
        details,
      });

      if (response.data.success) {
        // Process pending jobs
        const jobs = response.data.pendingJobs || [];
        for (const job of jobs) {
          await this.processJob(job);
        }
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }

  private async pollJobs() {
    while (!this.stopping) {
      await new Promise(r => setTimeout(r, 5000));
      // Jobs are fetched via heartbeat
    }
  }

  private async processJob(job: any) {
    console.log(`Processing job: ${job.type}`);

    try {
      let result;

      switch (job.type) {
        case 'CLIENT_CREATE':
          result = await this.ops.createClient(job.payload.clientName);
          // Send result back
          break;

        case 'CLIENT_REVOKE':
          result = await this.ops.revokeClient(job.payload.clientName);
          break;

        case 'NODE_SYNC':
          result = await this.ops.sync();
          break;

        default:
          console.warn(`Unknown job type: ${job.type}`);
      }

      console.log(`Job ${job.id} completed`);
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
    }
  }

  private getAgentVersion(): string {
    return '1.0.0';
  }

  private getSystemInfo() {
    return {
      os: process.platform,
      kernel: process.version,
      arch: process.arch,
    };
  }
}
