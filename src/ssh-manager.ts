import { Client, ClientChannel, ConnectConfig, SFTPWrapper } from 'ssh2';
import { readFile, stat } from 'fs/promises';
import type { SSHConfig, CommandResult, PortForwardInfo, FileInfo, FileTransferResult, FileListResult, FileDeleteResult } from './types.js';
import { createServer, Server as NetServer } from 'net';
import { expandTilde, validateCommandTimeout } from './utils.js';
import { createReadStream, createWriteStream } from 'fs';

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

  async executeCommand(config: SSHConfig, command: string, commandTimeout?: number): Promise<CommandResult> {
    validateCommandTimeout(commandTimeout);

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
        let settled = false;
        let timeoutId: NodeJS.Timeout | undefined;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
        };

        const resolveOnce = (result: CommandResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };

        const rejectOnce = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        if (commandTimeout !== undefined) {
          timeoutId = setTimeout(() => {
            try {
              stream.close();
            } catch {
              // ignore
            }

            resolveOnce({ stdout, stderr, exitCode: null, timedOut: true });
          }, commandTimeout);
        }

        stream.on('close', (code: number) => {
          exitCode = code;
          resolveOnce({ stdout, stderr, exitCode });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('error', (err: Error) => {
          rejectOnce(err);
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

    if (localPort !== 0 && this.forwardingServers.has(forwardKey)) {
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
          socket.localPort || localPort,
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
        const allocatedPort = localPort === 0 ? (server.address() as any).port : localPort;
        const actualForwardKey = `${this.getConnectionKey(config)}:${allocatedPort}->${remoteHost}:${remotePort}`;

        this.forwardingServers.set(actualForwardKey, {
          config,
          localPort: allocatedPort,
          remoteHost,
          remotePort,
          server,
        });

        resolve({
          localPort: allocatedPort,
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

  private async getSFTP(config: SSHConfig): Promise<SFTPWrapper> {
    const client = await this.getConnection(config);

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(sftp);
      });
    });
  }

  async uploadFile(
    config: SSHConfig,
    localPath: string,
    remotePath: string,
    permissions?: string
  ): Promise<FileTransferResult> {
    const expandedLocalPath = expandTilde(localPath);
    
    try {
      const stats = await stat(expandedLocalPath);
      if (!stats.isFile()) {
        return {
          success: false,
          message: `Local path ${localPath} is not a file`,
        };
      }

      const sftp = await this.getSFTP(config);

      return new Promise((resolve, reject) => {
        const readStream = createReadStream(expandedLocalPath);
        const writeStream = sftp.createWriteStream(remotePath);

        let bytesTransferred = 0;

        readStream.on('data', (chunk) => {
          bytesTransferred += chunk.length;
        });

        writeStream.on('close', async () => {
          if (permissions) {
            try {
              const mode = parseInt(permissions, 8);
              await new Promise<void>((res, rej) => {
                sftp.chmod(remotePath, mode, (err: Error | null | undefined) => {
                  if (err) rej(err);
                  else res();
                });
              });
            } catch (err) {
              console.warn(`Failed to set permissions: ${err}`);
            }
          }

          sftp.end();
          resolve({
            success: true,
            bytesTransferred,
            message: `Successfully uploaded ${localPath} to ${remotePath}`,
          });
        });

        writeStream.on('error', (err: Error) => {
          sftp.end();
          reject(err);
        });

        readStream.on('error', (err: Error) => {
          sftp.end();
          reject(err);
        });

        readStream.pipe(writeStream);
      });
    } catch (error) {
      return {
        success: false,
        message: `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async downloadFile(
    config: SSHConfig,
    remotePath: string,
    localPath: string
  ): Promise<FileTransferResult> {
    const expandedLocalPath = expandTilde(localPath);

    try {
      const sftp = await this.getSFTP(config);

      return new Promise((resolve, reject) => {
        const readStream = sftp.createReadStream(remotePath);
        const writeStream = createWriteStream(expandedLocalPath);

        let bytesTransferred = 0;

        readStream.on('data', (chunk: Buffer) => {
          bytesTransferred += chunk.length;
        });

        writeStream.on('close', () => {
          sftp.end();
          resolve({
            success: true,
            bytesTransferred,
            message: `Successfully downloaded ${remotePath} to ${localPath}`,
          });
        });

        writeStream.on('error', (err: Error) => {
          sftp.end();
          reject(err);
        });

        readStream.on('error', (err: Error) => {
          sftp.end();
          reject(err);
        });

        readStream.pipe(writeStream);
      });
    } catch (error) {
      return {
        success: false,
        message: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async listRemoteFiles(
    config: SSHConfig,
    remotePath: string,
    pattern?: string
  ): Promise<FileListResult> {
    try {
      const sftp = await this.getSFTP(config);

      const files = await new Promise<FileInfo[]>((resolve, reject) => {
        sftp.readdir(remotePath, (err, list) => {
          sftp.end();
          if (err) {
            reject(err);
            return;
          }

          const fileList = list.map(item => ({
            filename: item.filename,
            longname: item.longname,
            attrs: {
              mode: item.attrs.mode,
              uid: item.attrs.uid,
              gid: item.attrs.gid,
              size: item.attrs.size,
              atime: item.attrs.atime,
              mtime: item.attrs.mtime,
            },
          }));

          resolve(fileList);
        });
      });

      let filteredFiles = files;
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        filteredFiles = files.filter(file => regex.test(file.filename));
      }

      return {
        files: filteredFiles,
        totalCount: filteredFiles.length,
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteRemoteFile(
    config: SSHConfig,
    remotePath: string
  ): Promise<FileDeleteResult> {
    try {
      const sftp = await this.getSFTP(config);

      await new Promise<void>((resolve, reject) => {
        sftp.unlink(remotePath, (err) => {
          sftp.end();
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });

      return {
        success: true,
        message: `Successfully deleted ${remotePath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Delete failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
