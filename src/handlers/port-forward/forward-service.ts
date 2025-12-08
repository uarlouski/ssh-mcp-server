import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from '../../tools/types.js';
import type { HandlerContext } from '../types.js';
import { buildToolResult } from '../response-builder.js';

interface ForwardServiceArgs {
  serviceName: string;
}

const definition: Tool = {
  name: 'ssh_port_forward_service',
  description:
    'Start a pre-configured named port forwarding service from config.json. The service must be defined in the portForwardingServices section of the configuration.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the port forwarding service defined in config.json',
      },
    },
    required: ['serviceName'],
  },
};

const handler = async (args: ForwardServiceArgs, context: HandlerContext): Promise<CallToolResult> => {
  const { serviceName } = args;

  const service = context.configManager.getPortForwardingService(serviceName);
  const sshConfig = context.configManager.getServer(service.connectionName);

  const forwardResult = await context.sshManager.setupPortForward(
    sshConfig,
    service.localPort || 0,
    service.remoteHost,
    service.remotePort
  );

  return buildToolResult({
    success: true,
    serviceName,
    description: service.description,
    localPort: forwardResult.localPort,
    remoteHost: service.remoteHost,
    remotePort: service.remotePort,
    status: forwardResult.status,
    message: `Port forwarding service '${serviceName}' ${forwardResult.status}: localhost:${forwardResult.localPort} -> ${service.remoteHost}:${service.remotePort}`,
  });
};

export const forwardService = <ToolRegistration<ForwardServiceArgs>>{
  definition,
  handler,
};
