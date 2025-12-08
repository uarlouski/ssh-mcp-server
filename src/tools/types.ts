import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SSHConnectionManager } from '../ssh-manager.js';
import type { ConfigManager } from '../config.js';

export interface ToolRegistration<TArgs = any> {
  definition: Tool;
  handler: (args: TArgs, context: HandlerContext) => Promise<CallToolResult>;
}

export interface HandlerContext {
  sshManager: SSHConnectionManager;
  configManager: ConfigManager;
}
