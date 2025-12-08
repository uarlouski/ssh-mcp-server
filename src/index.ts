#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SSHConnectionManager } from './ssh-manager.js';
import { ConfigManager } from './config.js';
import { tools, handlers } from './tools/registry.js';
import type { HandlerContext } from './tools/types.js';
import { join } from 'path';
import { existsSync } from 'fs';

const args = process.argv.slice(2);
const configPathArg = args.find(arg => arg.startsWith('--configPath='));

let configPath: string;
if (configPathArg) {
  configPath = configPathArg.split('=')[1];
} else {
  const defaultConfigs = ['ssh-mcp-config.json', 'config.json'];
  const found = defaultConfigs.find(name => existsSync(join(process.cwd(), name)));

  if (found === 'config.json') {
    console.error('⚠️  Warning: config.json is deprecated. Please rename to ssh-mcp-config.json');
  }

  configPath = join(process.cwd(), found || 'ssh-mcp-config.json');
}

const configManager = new ConfigManager(configPath);
const sshManager = new SSHConnectionManager();

await configManager.load();

const server = new Server(
  {
    name: 'ssh-mcp-server',
    version: '1.2.0',
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
    const handler = handlers.get(name);
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
