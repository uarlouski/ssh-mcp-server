import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { readFile } from 'fs/promises';
import type { SSHConfig, CommandResult, PortForwardInfo } from './types.js';
import { createServer, Server as NetServer } from 'net';
import { expandTilde } from './utils.js';

interface ForwardingInfo {
  config: SSHConfig;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  server: NetServer;
}

export class SSHConnectionManager {
  private connections: Map<string, Client> = new Map();
  private forwardingServers: Map<string, ForwardingInfo> = new Map();
  private maxConnections: number;

  constructor(maxConnections: number = 5) {
    this.maxConnections = maxConnections;
  }

  private getConnectionKey(config: SSHConfig): string {
    return `${config.username}@${config.host}:${config.port}`;
  }

  async getConnection(config: SSHConfig): Promise<Client> {
    const key = this.getConnectionKey(config);

    if (this.connections.has(key)) {
      const existingClient = this.connections.get(key)!;
      if ((existingClient as any)._sock && !(existingClient as any)._sock.destroyed) {
        return existingClient;
      } else {
        this.connections.delete(key);
      }
    }

    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum number of connections (${this.maxConnections}) reached`);
    }

    const client = await this.createConnection(config);
    this.connections.set(key, client);

    return client;
  }

  private async createConnection(config: SSHConfig): Promise<Client> {
    const client = new Client();

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 30000,
    };

    const expandedKeyPath = expandTilde(config.privateKeyPath);
    connectConfig.privateKey = await readFile(expandedKeyPath, 'utf-8');

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        resolve(client);
      });

      client.on('error', (err) => {
        reject(err);
      });

      client.connect(connectConfig);
    });
  }

  async executeCommand(config: SSHConfig, command: string): Promise<CommandResult> {
    const client = await this.getConnection(config);

    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode: number | null = null;

        stream.on('close', (code: number) => {
          exitCode = code;
          resolve({ stdout, stderr, exitCode });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (err: Error) => {
          reject(err);
        });
      });
    });
  }

  async setupPortForward(
    config: SSHConfig,
    localPort: number,
    remoteHost: string,
    remotePort: number
  ): Promise<{ localPort: number; status: string }> {
    const client = await this.getConnection(config);
    const forwardKey = `${this.getConnectionKey(config)}:${localPort}->${remoteHost}:${remotePort}`;

    if (this.forwardingServers.has(forwardKey)) {
      return {
        localPort,
        status: 'already_active'
      };
    }

    return new Promise((resolve, reject) => {
      const server = createServer((socket) => {
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 60000);

        client.forwardOut(
          '127.0.0.1',
          localPort,
          remoteHost,
          remotePort,
          (err, stream) => {
            if (err) {
              console.error(`Port forward error: ${err.message}`);
              socket.destroy();
              return;
            }

            socket.pipe(stream);
            stream.pipe(socket);

            socket.on('close', () => {
              stream.end();
            });

            socket.on('end', () => {
              stream.end();
            });

            stream.on('close', () => {
              socket.end();
            });

            stream.on('end', () => {
              socket.end();
            });

            socket.on('error', (err) => {
              console.error(`Socket error: ${err.message}`);
              stream.destroy();
            });

            stream.on('error', (err: Error) => {
              console.error(`Stream error: ${err.message}`);
              socket.destroy();
            });
          }
        );
      });

      server.listen(localPort, '127.0.0.1', () => {
        this.forwardingServers.set(forwardKey, {
          config,
          localPort,
          remoteHost,
          remotePort,
          server,
        });
        resolve({
          localPort,
          status: 'active'
        });
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  async closePortForward(
    config: SSHConfig,
    localPort: number,
    remoteHost: string,
    remotePort: number
  ): Promise<void> {
    const forwardKey = `${this.getConnectionKey(config)}:${localPort}->${remoteHost}:${remotePort}`;
    const forwardInfo = this.forwardingServers.get(forwardKey);

    if (forwardInfo) {
      return new Promise((resolve) => {
        forwardInfo.server.close(() => {
          this.forwardingServers.delete(forwardKey);
          resolve();
        });
      });
    }
  }

  listPortForwards(): PortForwardInfo[] {
    const forwards: PortForwardInfo[] = [];

    for (const [key, info] of this.forwardingServers.entries()) {
      forwards.push({
        sshHost: info.config.host,
        sshPort: info.config.port || 22,
        sshUsername: info.config.username,
        localPort: info.localPort,
        remoteHost: info.remoteHost,
        remotePort: info.remotePort,
        status: 'active',
      });
    }

    return forwards;
  }

  disconnectAll(): void {
    for (const [key, forwardInfo] of this.forwardingServers.entries()) {
      forwardInfo.server.close();
      this.forwardingServers.delete(key);
    }

    for (const [key, client] of this.connections.entries()) {
      client.end();
      this.connections.delete(key);
    }
  }
}
