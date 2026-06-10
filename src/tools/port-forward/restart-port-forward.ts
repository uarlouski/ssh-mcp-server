import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  id: z.string().describe('ID of the active port forward to restart'),
};

export const restartPortForward: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_restart_port_forward',
  description: 'Restart an active SSH port forwarding tunnel using its unique ID.',
  parameters,
  handler: async ({ id }, context) => {
    const forwards = context.sshManager.listPortForwards();
    const forward = forwards.find(f => f.id === id);

    if (!forward) {
      throw new Error(`No active port forward found with ID: ${id}`);
    }

    const restartResult = await context.sshManager.restartPortForward(id);

    return buildToolResult({
      success: true,
      id: restartResult.id,
      localPort: restartResult.localPort,
      remoteHost: forward.remoteHost,
      remotePort: forward.remotePort,
      status: restartResult.status,
      message: `Port forwarding restarted: localhost:${restartResult.localPort} -> ${forward.remoteHost}:${forward.remotePort}`,
    });
  }
};
