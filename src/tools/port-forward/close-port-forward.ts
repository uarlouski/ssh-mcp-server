import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  localPort: z.number().describe('Local port that was forwarded'),
};

export const closePortForward: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_close_port_forward',
  description: 'Close an active SSH port forwarding tunnel. Only connectionName and localPort are needed.',
  parameters,
  handler: async ({ connectionName, localPort }, context) => {
    const sshConfig = context.configManager.getServer(connectionName);

    const forwards = context.sshManager.listPortForwards();
    const forward = forwards.find(f =>
      f.sshHost === sshConfig.host &&
      f.sshPort === sshConfig.port &&
      f.sshUsername === sshConfig.username &&
      f.localPort === localPort
    );

    if (!forward) {
      throw new Error(`No active port forward found for ${connectionName} on local port ${localPort}`);
    }

    await context.sshManager.closePortForward(sshConfig, localPort, forward.remoteHost, forward.remotePort);

    return buildToolResult({
      success: true,
      message: `Port forwarding closed: localhost:${localPort} -> ${forward.remoteHost}:${forward.remotePort}`,
    });
  }
};
