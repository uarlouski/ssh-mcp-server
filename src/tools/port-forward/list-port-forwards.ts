import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {};

export const listPortForwards: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_list_port_forwards',
  description: 'List all active SSH port forwarding tunnels',
  parameters,
  handler: async (_args, context) => {
    const forwards = context.sshManager.listPortForwards();

    return buildToolResult({
      success: true,
      count: forwards.length,
      forwards: forwards.map(f => ({
        sshConnection: `${f.sshUsername}@${f.sshHost}:${f.sshPort}`,
        tunnel: `localhost:${f.localPort} -> ${f.remoteHost}:${f.remotePort}`,
        status: f.status,
      })),
    });
  }
};
