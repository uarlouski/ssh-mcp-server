import type { ToolRegistration, HandlerContext } from '../types.js';
import { buildToolResult } from '../response-builder.js';

interface PortForwardArgs {
  connectionName: string;
  localPort?: number;
  remoteHost: string;
  remotePort: number;
}

const definition = {
  name: 'ssh_port_forward',
  description:
    'Set up SSH port forwarding (local port to remote host:port). The connectionName must reference a pre-configured server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      localPort: {
        type: 'number',
        description: 'Local port to listen on',
      },
      remoteHost: {
        type: 'string',
        description: 'Remote host to forward to (from SSH server perspective)',
      },
      remotePort: {
        type: 'number',
        description: 'Remote port to forward to',
      },
    },
    required: ['connectionName', 'remoteHost', 'remotePort'],
  },
};

const handler = async (args: PortForwardArgs, context: HandlerContext) => {
  const { connectionName, localPort = 0, remoteHost, remotePort } = args;

  const sshConfig = context.configManager.getServer(connectionName);

  const forwardResult = await context.sshManager.setupPortForward(
    sshConfig,
    localPort,
    remoteHost,
    remotePort
  );

  return buildToolResult({
    success: true,
    localPort: forwardResult.localPort,
    remoteHost,
    remotePort,
    status: forwardResult.status,
    message: `Port forwarding active: localhost:${forwardResult.localPort} -> ${remoteHost}:${remotePort}`,
  });
};

export const portForward = <ToolRegistration<PortForwardArgs>>{
  definition,
  handler,
};
