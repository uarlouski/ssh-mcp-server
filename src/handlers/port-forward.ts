import type { HandlerContext } from './execute-command.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function handlePortForward(
  args: any,
  context: HandlerContext
): Promise<CallToolResult> {
  const { connectionName, localPort, remoteHost, remotePort } = args;

  const sshConfig = context.configManager.getServer(connectionName);

  const forwardResult = await context.sshManager.setupPortForward(
    sshConfig,
    localPort,
    remoteHost,
    remotePort
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          localPort: forwardResult.localPort,
          remoteHost,
          remotePort,
          status: forwardResult.status,
          message: `Port forwarding active: localhost:${forwardResult.localPort} -> ${remoteHost}:${remotePort}`,
        }, null, 2),
      },
    ],
  };
}
