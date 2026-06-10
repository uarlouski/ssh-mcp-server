import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  localPort: z.number().optional().describe('Local port to listen on'),
  remoteHost: z.string().describe('Remote host to forward to (from SSH server perspective)'),
  remotePort: z.number().describe('Remote port to forward to'),
};

export const portForward: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_port_forward',
  description:
    'Set up SSH port forwarding (local port to remote host:port). The connectionName must reference a pre-configured server in config.json.',
  parameters,
  handler: async ({ connectionName, localPort = 0, remoteHost, remotePort }, context) => {
    const sshConfig = context.configManager.getServer(connectionName);

    const forwardResult = await context.sshManager.setupPortForward(
      sshConfig,
      localPort,
      remoteHost,
      remotePort
    );

    return buildToolResult({
      success: true,
      id: forwardResult.id,
      localPort: forwardResult.localPort,
      remoteHost,
      remotePort,
      status: forwardResult.status,
      message: `Port forwarding active: localhost:${forwardResult.localPort} -> ${remoteHost}:${remotePort}`,
    });
  }
};
