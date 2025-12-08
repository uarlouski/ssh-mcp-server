import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from '../../tools/types.js';
import type { HandlerContext } from '../types.js';
import { buildToolResult } from '../response-builder.js';

const definition: Tool = {
  name: 'ssh_list_port_forwards',
  description: 'List all active SSH port forwarding tunnels',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const handler = async (_args: any, context: HandlerContext): Promise<CallToolResult> => {
  const forwards = context.sshManager.listPortForwards();

  return buildToolResult({
    success: true,
    count: forwards.length,
    forwards: forwards.map(f => ({
      sshConnection: `${f.sshUsername}@${f.sshHost}:${f.sshPort}`,
      tunnel: `localhost:${f.localPort} -> ${f.remoteHost}:${f.remotePort}`,
      status: f.status,
    })),
  });
};

export const listPortForwards = <ToolRegistration>{
  definition,
  handler,
};
