import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Config, SSHConfig } from './types.js';
import { CommandParser } from './command-parser.js';
import { expandTilde } from './utils.js';

export class ConfigManager {
  private config: Config = {};
  private configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  async load(): Promise<void> {
    if (!existsSync(this.configPath)) {
      throw new Error(`Config file not found at ${this.configPath}`);
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
      this.validateConfig();
    } catch (error) {
      console.error(`Failed to load config: ${error}`);
      throw error;
    }
  }

  private validateConfig(): void {
    if (!this.config.servers) {
      return;
    }

    for (const [serverName, serverConfig] of Object.entries(this.config.servers)) {
      this.validateServerConfig(serverName, serverConfig);
    }

    if (this.config.portForwardingServices) {
      for (const [serviceName, serviceConfig] of Object.entries(this.config.portForwardingServices)) {
        this.validatePortForwardingService(serviceName, serviceConfig);
      }
    }
  }

  private validateServerConfig(serverName: string, config: SSHConfig): void {
    const errors: string[] = [];

    if (this.isEmptyValue(config.host)) {
      errors.push('host is required and must be a non-empty string');
    }

    if (config.port === undefined || config.port === null) {
      config.port = 22;
    } else if (!this.isValidPort(config.port)) {
      errors.push('port must be a number between 1 and 65535');
    }

    if (this.isEmptyValue(config.username)) {
      errors.push('username is required and must be a non-empty string');
    }

    if (this.isEmptyValue(config.privateKeyPath)) {
      errors.push('privateKeyPath is required and must be a non-empty string');
    } else {
      const expandedPath = expandTilde(config.privateKeyPath);

      if (!existsSync(expandedPath)) {
        errors.push(`privateKeyPath file does not exist: ${config.privateKeyPath}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid configuration for server '${serverName}':\n  - ${errors.join('\n  - ')}`
      );
    }
  }

  isValidPort(port: number, dynamicAllocation: boolean = false): boolean {
    const lowRange = dynamicAllocation ? 0 : 1;
    return typeof port === 'number' && port >= lowRange && port <= 65535;
  }

  isEmptyValue(value: string) {
    return !value || typeof value !== 'string' || value.trim() === ''
  }

  private validatePortForwardingService(serviceName: string, service: any): void {
    const errors: string[] = [];

    if (this.isEmptyValue(service.connectionName)) {
      errors.push('connectionName is required and must reference a server in config.json');
    } else if (!this.config.servers?.[service.connectionName]) {
      errors.push(`connectionName '${service.connectionName}' does not exist in servers`);
    }

    if (this.isEmptyValue(service.remoteHost)) {
      errors.push('remoteHost is required and must be a non-empty string');
    }

    if (!this.isValidPort(service.remotePort)) {
      errors.push('remotePort must be a number between 1 and 65535');
    }

    if (service.localPort !== undefined && service.localPort !== null) {
      if (!this.isValidPort(service.localPort, true)) {
        errors.push('localPort must be a number between 0 and 65535 (0 for dynamic allocation)');
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid port forwarding service '${serviceName}':\n  - ${errors.join('\n  - ')}`
      );
    }
  }

  isCommandAllowed(command: string): boolean {
    if (!this.config.allowedCommands || this.config.allowedCommands.length === 0) {
      return true;
    }
    const commands = CommandParser.extractCommands(command);
    return commands.every(cmd => this.config.allowedCommands!.includes(cmd));
  }

  getServer(connectionName: string | undefined): SSHConfig {
    if (!connectionName) {
      throw new Error('connectionName is required and must reference a server configured in config.json');
    }

    const sshConfig = this.config.servers?.[connectionName];
    if (!sshConfig) {
      throw new Error(`Server configuration '${connectionName}' not found in config.json`);
    }

    return sshConfig;
  }

  getTimeout(): number {
    return this.config.timeout || 30000;
  }

  getMaxConnections(): number {
    return this.config.maxConnections || 5;
  }

  getPortForwardingService(serviceName: string): any {
    if (!serviceName) {
      throw new Error('serviceName is required');
    }

    const service = this.config.portForwardingServices?.[serviceName];
    if (!service) {
      throw new Error(`Port forwarding service '${serviceName}' not found in config.json`);
    }

    return service;
  }

  listPortForwardingServices(): string[] {
    return Object.keys(this.config.portForwardingServices || {});
  }
}
