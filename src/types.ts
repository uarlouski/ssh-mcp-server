export interface SSHConfig {
  host: string;
  port?: number;
  username: string;
  privateKeyPath: string;
}

export interface PortForwardingService {
  connectionName: string;
  localPort?: number;
  remoteHost: string;
  remotePort: number;
  description?: string;
}

export interface Config {
  allowedCommands?: string[];
  servers?: Record<string, SSHConfig>;
  portForwardingServices?: Record<string, PortForwardingService>;
  timeout?: number;
  maxConnections?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface PortForwardInfo {
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: 'active';
}
