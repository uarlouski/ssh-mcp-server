import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from '../../tools/types.js';
import type { HandlerContext } from '../types.js';
import { buildToolResult } from '../response-builder.js';

interface ClosePortForwardArgs {
  connectionName: string;
  localPort: number;
}

const definition: Tool = {
  name: 'ssh_close_port_forward',
  description: 'Close an active SSH port forwarding tunnel. Only connectionName and localPort are needed.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      localPort: {
        type: 'number',
        description: 'Local port that was forwarded',
      },
    },
    required: ['connectionName', 'localPort'],
  },
};

const handler = async (args: ClosePortForwardArgs, context: HandlerContext): Promise<CallToolResult> => {
  const { connectionName, localPort } = args;

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
};

export const closePortForward = <ToolRegistration<ClosePortForwardArgs>>{
  definition,
  handler,
};
