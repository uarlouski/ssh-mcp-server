import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './execute-command.js';

export async function handleForwardService(
  args: any,
  context: HandlerContext
): Promise<CallToolResult> {
  const { serviceName } = args;

  const service = context.configManager.getPortForwardingService(serviceName);
  const sshConfig = context.configManager.getServer(service.connectionName);

  const forwardResult = await context.sshManager.setupPortForward(
    sshConfig,
    service.localPort || 0,
    service.remoteHost,
    service.remotePort
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          serviceName,
          description: service.description,
          localPort: forwardResult.localPort,
          remoteHost: service.remoteHost,
          remotePort: service.remotePort,
          status: forwardResult.status,
          message: `Port forwarding service '${serviceName}' ${forwardResult.status}: localhost:${forwardResult.localPort} -> ${service.remoteHost}:${service.remotePort}`,
        }, null, 2),
      },
    ],
  };
}
