import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {};

export const listServers: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_list_servers',
  description:
    'List all available SSH servers configured in config file with their connection details. ' +
    'This helps discover what servers are available for SSH operations.',
  parameters,
  handler: async (_args, context) => {
    const servers = context.configManager.listServers();

    return buildToolResult({
      success: true,
      servers: servers,
      count: servers.length,
    });
  }
};
