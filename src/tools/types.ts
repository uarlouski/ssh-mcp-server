import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SSHConnectionManager } from '../ssh-manager.js';
import type { ConfigManager } from '../config.js';
import z from 'zod';

export interface HandlerContext {
  sshManager: SSHConnectionManager;
  configManager: ConfigManager;
}

export interface ToolDefinition<T extends z.ZodRawShape, Context = any> {
  name: string,
  description: string,
  parameters: T,
  handler: (args: z.infer<z.ZodObject<T>>, context: Context) => Promise<CallToolResult>
}
