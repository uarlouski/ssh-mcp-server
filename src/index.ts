#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSHConnectionManager } from './ssh-manager.js';
import { ConfigManager } from './config.js';
import { tools } from './tools/definitions.js';
import {
  handleExecuteCommand,
  handlePortForward,
  handleClosePortForward,
  handleListPortForwards,
  handleForwardService,
  type HandlerContext,
} from './handlers/index.js';
import { join } from 'path';

const args = process.argv.slice(2);
const configPathArg = args.find(arg => arg.startsWith('--configPath='));
const configPath = configPathArg ? configPathArg.split('=')[1] : join(process.cwd(), 'config.json');

const configManager = new ConfigManager(configPath);
const sshManager = new SSHConnectionManager();

await configManager.load();

const server = new Server(
  {
    name: 'ssh-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const handlerContext: HandlerContext = {
  sshManager,
  configManager,
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const toolHandlers: Record<string, (args: any, context: HandlerContext) => Promise<any>> = {
      'ssh_execute_command': handleExecuteCommand,
      'ssh_port_forward': handlePortForward,
      'ssh_close_port_forward': handleClosePortForward,
      'ssh_list_port_forwards': handleListPortForwards,
      'ssh_port_forward_service': handleForwardService,
    };

    const handler = toolHandlers[name];
    if (handler) {
      return await handler(args, handlerContext);
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SSH MCP Server running on stdio');

  const shutdownHook = () => {
    console.error('Shutting down...');
    sshManager.disconnectAll();
    process.exit(0);
  }

  process.on('SIGINT', shutdownHook);
  process.on('SIGTERM', shutdownHook);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
