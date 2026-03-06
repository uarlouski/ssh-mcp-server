import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  serviceName: z.string().describe('Name of the port forwarding service defined in config.json'),
};

export const forwardService: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_port_forward_service',
  description:
    'Start a pre-configured named port forwarding service from config.json. The service must be defined in the portForwardingServices section of the configuration.',
  parameters,
  handler: async ({ serviceName }, context) => {
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
  }
};
