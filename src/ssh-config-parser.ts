import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import picomatch from 'picomatch';
import SSHConfig, { LineType } from 'ssh-config';
import type { SSHConfig as SSHServerConfig, SSHConfigImport } from './types.js';
import { expandTilde } from './utils.js';

/**
 * Parses SSH config files in an OS-agnostic way
 */
export class SSHConfigParser {
  /**
   * Parse SSH config file and extract server configurations
   */
  static async parseSSHConfig(
    importConfig: SSHConfigImport
  ): Promise<Record<string, SSHServerConfig>> {
    const configPath = importConfig.path 
      ? expandTilde(importConfig.path)
      : join(homedir(), '.ssh', 'config');

    if (!existsSync(configPath)) {
      console.error(`[SSH-MCP] SSH config file not found at: ${configPath}`);
      return {};
    }

    if (!importConfig.hosts || importConfig.hosts?.length === 0) {
      console.error('[SSH-MCP] sshConfigImport.hosts is empty array, no servers will be imported');
      return {};
    }

    try {
      const content = await readFile(configPath, 'utf-8');
      const sshConfig = SSHConfig.parse(content);
      
      const servers: Record<string, SSHServerConfig> = {};

      const matcher = picomatch(importConfig.hosts);
      
      for (const line of sshConfig) {
        if (line.type === LineType.DIRECTIVE && line.param === 'Host') {
          const hostValue = typeof line.value === 'string' ? line.value : '';

          if (!hostValue || hostValue.includes('*') || hostValue.includes('?') || !matcher(hostValue)) {
            continue;
          }

          const computedConfig = sshConfig.compute(hostValue);
          
          const hostname = (computedConfig.HostName as string) || hostValue;
          const port = parseInt(String(computedConfig.Port ?? 22), 10);
          const username = computedConfig.User as string;
          const privateKeyPath = Array.isArray(computedConfig.IdentityFile) 
            ? computedConfig.IdentityFile[0] 
            : computedConfig.IdentityFile as string | undefined;

          if (hostname && username && privateKeyPath) {
            servers[hostValue] = {
              host: hostname,
              port,
              username,
              privateKeyPath: expandTilde(privateKeyPath),
            };
          } else {
            console.error(
              `[SSH-MCP] Skipping SSH config host '${hostValue}': missing required fields ` +
              `(HostName: ${hostname}, User: ${username}, IdentityFile: ${privateKeyPath})`
            );
          }
        }
      }

      return servers;
    } catch (error) {
      throw new Error(`Failed to parse SSH config file at ${configPath}: ${error}`);
    }
  }
}

