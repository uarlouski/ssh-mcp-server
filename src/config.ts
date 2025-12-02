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
  }

  private validateServerConfig(serverName: string, config: SSHConfig): void {
    const errors: string[] = [];

    if (this.isEmptyValue(config.host)) {
      errors.push('host is required and must be a non-empty string');
    }

    if (config.port === undefined || config.port === null) {
      config.port = 22;
    } else if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
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

  isEmptyValue(value: string) {
    return !value || typeof value !== 'string' || value.trim() === ''
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
}
