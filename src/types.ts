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

export interface CommandTemplate {
  command: string;
  description?: string;
}

export interface Config {
  allowedCommands?: string[];
  servers?: Record<string, SSHConfig>;
  portForwardingServices?: Record<string, PortForwardingService>;
  commandTemplates?: Record<string, string | CommandTemplate>;
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

export interface FileInfo {
  filename: string;
  longname: string;
  attrs: {
    mode: number;
    uid: number;
    gid: number;
    size: number;
    atime: number;
    mtime: number;
  };
}

export interface FileTransferResult {
  success: boolean;
  bytesTransferred?: number;
  message: string;
}

export interface FileListResult {
  files: FileInfo[];
  totalCount: number;
}

export interface FileDeleteResult {
  success: boolean;
  message: string;
}
