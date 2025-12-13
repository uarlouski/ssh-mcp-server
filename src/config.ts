import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { Config, SSHConfig, CommandTemplate } from './types.js';
import { CommandParser } from './command-parser.js';
import { expandTilde, validateCommandTimeout, validateRequiredString } from './utils.js';
import { substituteVariables } from './template-processor.js';

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
    validateCommandTimeout(this.config.commandTimeout);

    if (this.config.servers) {
      for (const [serverName, serverConfig] of Object.entries(this.config.servers)) {
        this.validateServerConfig(serverName, serverConfig);
      }
    }

    if (this.config.portForwardingServices) {
      for (const [serviceName, serviceConfig] of Object.entries(this.config.portForwardingServices)) {
        this.validatePortForwardingService(serviceName, serviceConfig);
      }
    }

    if (this.config.commandTemplates) {
      for (const [templateName, template] of Object.entries(this.config.commandTemplates)) {
        this.validateCommandTemplate(templateName, template);
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

  private validateCommandTemplate(templateName: string, template: string | CommandTemplate): void {
    const errors: string[] = [];

    try {
      validateRequiredString(templateName, 'Template name');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    if (typeof template === 'string') {
      try {
        validateRequiredString(template, 'Template command');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    } else if (typeof template === 'object' && template !== null) {
      try {
        validateRequiredString(template.command, 'Template command');
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      if (template.description !== undefined && this.isEmptyValue(template.description)) {
        errors.push('Template description, if provided, must be a non-empty string');
      }
    } else {
      errors.push('Template must be either a string or an object with a command property');
    }

    if (errors.length > 0) {
      throw new Error(
        `Invalid command template '${templateName}':\n  - ${errors.join('\n  - ')}`
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

  getCommandTimeout(): number {
    return this.config.commandTimeout || 30000;
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

  getCommandTemplate(templateName: string): string {
    if (!templateName) {
      throw new Error('templateName is required');
    }

    const template = this.config.commandTemplates?.[templateName];
    if (!template) {
      throw new Error(`Command template '${templateName}' not found in config.json`);
    }

    if (typeof template === 'string') {
      return template;
    } else {
      return template.command;
    }
  }

  listCommandTemplates(): Array<{ name: string; command: string; description?: string }> {
    if (!this.config.commandTemplates) {
      return [];
    }

    return Object.entries(this.config.commandTemplates).map(([name, template]) => {
      if (typeof template === 'string') {
        return { name, command: template };
      } else {
        return { name, command: template.command, description: template.description };
      }
    });
  }
}
