import type { HandlerContext } from './execute-command.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function handleListPortForwards(
  args: any,
  context: HandlerContext
): Promise<CallToolResult> {
  const forwards = context.sshManager.listPortForwards();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          count: forwards.length,
          forwards: forwards.map(f => ({
            sshConnection: `${f.sshUsername}@${f.sshHost}:${f.sshPort}`,
            tunnel: `localhost:${f.localPort} -> ${f.remoteHost}:${f.remotePort}`,
            status: f.status,
          })),
        }, null, 2),
      },
    ],
  };
}
