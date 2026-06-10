import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  id: z.string().describe('ID of the active port forward to close'),
};

export const closePortForward: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_close_port_forward',
  description: 'Close an active SSH port forwarding tunnel using its unique ID.',
  parameters,
  handler: async ({ id }, context) => {
    const forwards = context.sshManager.listPortForwards();
    const forward = forwards.find(f => f.id === id);

    if (!forward) {
      throw new Error(`No active port forward found with ID: ${id}`);
    }

    await context.sshManager.closePortForward(id);

    return buildToolResult({
      success: true,
      message: `Port forwarding closed: localhost:${forward.localPort} -> ${forward.remoteHost}:${forward.remotePort}`,
    });
  }
};
