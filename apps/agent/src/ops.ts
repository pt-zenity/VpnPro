import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

// Paths from the install script
const OVPN_DIR = '/etc/openvpn/xor';
const ADMIN_DIR = '/root/ovpn-xor-admin';
const OVPN_BIN = '/usr/local/sbin/openvpn-xor';

export interface OpenVpnStatus {
  openvpn: 'RUNNING' | 'STOPPED' | 'ERROR';
  version?: string;
  xorMask?: string;
  connectedClients: number;
  uptime: number;
  port: number;
  protocol: 'udp' | 'tcp';
}

export interface OpenVpnDetails {
  connectedClients?: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  uptime?: number;
}

export class OpenVpnOps {
  async getStatus(): Promise<OpenVpnStatus> {
    try {
      // Check systemd status
      const { stdout: systemctlOutput } = await exec('systemctl', ['is-active', 'openvpn-xor']);
      const isActive = systemctlOutput.trim() === 'active';

      if (!isActive) {
        return {
          openvpn: 'STOPPED',
          connectedClients: 0,
          uptime: 0,
          port: 443,
          protocol: 'udp',
        };
      }

      // Get OpenVPN version
      const { stdout: versionOutput } = await exec(OVPN_BIN, ['--version']);
      const versionMatch = versionOutput.match(/OpenVPN (\d+\.\d+\.\d+)/);
      const version = versionMatch?.[1];

      // Get XOR mask from config
      const { stdout: configOutput } = await exec('cat', [`${OVPN_DIR}/server.conf`]);
      const xorMatch = configOutput.match(/scramble xormask (\S+)/);
      const xorMask = xorMatch?.[1];

      // Get connected clients from status file
      const connectedClients = await this.getConnectedClientCount();

      // Get uptime
      const { stdout: uptimeOutput } = await exec('systemctl', ['show', 'openvpn-xor', '--property=ExecMainStartTimestamp']);
      const startTimeMatch = uptimeOutput.match(/ExecMainStartTimestamp=(.+)/);
      let uptime = 0;
      if (startTimeMatch?.[1]) {
        const startTime = new Date(startTimeMatch[1]);
        uptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
      }

      return {
        openvpn: 'RUNNING',
        version,
        xorMask,
        connectedClients,
        uptime,
        port: 443,
        protocol: 'udp',
      };
    } catch (error) {
      return {
        openvpn: 'ERROR',
        connectedClients: 0,
        uptime: 0,
        port: 443,
        protocol: 'udp',
      };
    }
  }

  async getDetails(): Promise<OpenVpnDetails> {
    try {
      // Get system stats
      const { stdout: vmstat } = await exec('vmstat', ['1', '2']);
      const lines = vmstat.split('\n');
      const cpuLine = lines[lines.length - 1].trim().split(/\s+/);
      const cpuIdle = parseInt(cpuLine[15] || '0', 10);
      const cpu = 100 - cpuIdle;

      // Memory from /proc/meminfo
      const { stdout: meminfo } = await exec('cat', ['/proc/meminfo']);
      const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || '0', 10);
      const memAvailable = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || '0', 10);
      const memory = ((memTotal - memAvailable) / memTotal) * 100;

      // Disk usage
      const { stdout: df } = await exec('df', ['/']);
      const dfLines = df.split('\n');
      const dfLine = dfLines[dfLines.length - 1].split(/\s+/);
      const disk = parseInt(dfLine[dfLine.length - 2] || '0', 10);

      return {
        cpu,
        memory,
        disk,
        connectedClients: await this.getConnectedClientCount(),
      };
    } catch (error) {
      console.error('Failed to get details:', error);
      return {};
    }
  }

  async createClient(name: string): Promise<{ success: true; client: any }> {
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      throw new Error('Invalid client name');
    }

    const script = `${ADMIN_DIR}/add-user.sh`;
    const { stdout, stderr } = await exec(script, [name], { timeout: 60000 });

    // Read the generated .ovpn file
    const { stdout: ovpnContent } = await exec('cat', [`${ADMIN_DIR}/clients/${name}.ovpn`]);

    // Get fingerprint from cert
    const { stdout: certInfo } = await exec(
      'openssl',
      ['x509', '-in', `${OVPN_DIR}/easy-rsa/pki/issued/${name}.crt`, '-noout', '-fingerprint', '-sha256'],
    );
    const fingerprint = certInfo.split('=')[1]?.trim();

    return {
      success: true,
      client: {
        name,
        fingerprint,
        ovpnContent: Buffer.from(ovpnContent).toString('base64'),
        createdAt: new Date().toISOString(),
      },
    };
  }

  async revokeClient(name: string): Promise<{ success: true }> {
    const script = `${ADMIN_DIR}/revoke-user.sh`;
    await exec(script, [name], { timeout: 60000 });

    return { success: true };
  }

  async listClients(): Promise<Array<{ name: string; status: string; fingerprint: string }>> {
    const script = `${ADMIN_DIR}/list-users.sh`;
    const { stdout } = await exec(script, []);

    // Parse output (active users only)
    const lines = stdout.split('\n');
    const clients: Array<{ name: string; status: string; fingerprint: string }> = [];

    for (const line of lines) {
      const match = line.match(/- (.+)$/);
      if (match) {
        const name = match[1];
        // Get fingerprint
        try {
          const { stdout: certInfo } = await exec(
            'openssl',
            ['x509', '-in', `${OVPN_DIR}/easy-rsa/pki/issued/${name}.crt`, '-noout', '-fingerprint', '-sha256'],
          );
          const fingerprint = certInfo.split('=')[1]?.trim();
          clients.push({ name, status: 'ACTIVE', fingerprint: fingerprint || '' });
        } catch {
          // Certificate might be revoked
        }
      }
    }

    return clients;
  }

  async sync(): Promise<{ success: true; clients: any[] }> {
    const clients = await this.listClients();
    return { success: true, clients };
  }

  async getClientConfig(name: string): Promise<{ success: true; ovpnContent: string }> {
    const { stdout } = await exec('cat', [`${ADMIN_DIR}/clients/${name}.ovpn`]);
    return {
      success: true,
      ovpnContent: Buffer.from(stdout).toString('base64'),
    };
  }

  private async getConnectedClientCount(): Promise<number> {
    try {
      const { stdout } = await exec('cat', ['/var/log/openvpn-xor-status.log']);
      const match = stdout.match(/n_clients=(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      return 0;
    }
  }
}
