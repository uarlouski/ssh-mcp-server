import type { HandlerContext } from './execute-command.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function handleClosePortForward(
  args: any,
  context: HandlerContext
): Promise<CallToolResult> {
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

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Port forwarding closed: localhost:${localPort} -> ${forward.remoteHost}:${forward.remotePort}`,
        }, null, 2),
      },
    ],
  };
}
