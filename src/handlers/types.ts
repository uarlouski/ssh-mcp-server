import type { SSHConnectionManager } from '../ssh-manager.js';
import type { ConfigManager } from '../config.js';

export interface HandlerContext {
  sshManager: SSHConnectionManager;
  configManager: ConfigManager;
}
