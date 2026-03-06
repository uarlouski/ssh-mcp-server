#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSHConnectionManager } from './ssh-manager.js';
import { ConfigManager } from './config.js';
import { AuditLogger } from './logger.js';
import type { HandlerContext } from './tools/types.js';
import { join } from 'path';
import { existsSync } from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listRemoteFiles } from './tools/sftp/list-remote-files.js';
import { uploadFile } from './tools/sftp/upload-file.js';
import { downloadFile } from './tools/sftp/download-file.js';
import { deleteRemoteFile } from './tools/sftp/delete-remote-file.js';
import { executeCommand } from './tools/core/execute-command.js';
import { listServers } from './tools/core/list-servers.js';
import { portForward } from './tools/port-forward/port-forward.js';
import { closePortForward } from './tools/port-forward/close-port-forward.js';
import { listPortForwards } from './tools/port-forward/list-port-forwards.js';
import { forwardService } from './tools/port-forward/forward-service.js';
import { executeTemplate } from './tools/templates/execute-template.js';
import { listTemplates } from './tools/templates/list-templates.js';

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
await configManager.load();

const auditConfig = configManager.getAuditLogConfig();
const auditLogger = new AuditLogger(
  auditConfig?.enabled ?? false,
  auditConfig?.folder ?? ''
);

const sshManager = new SSHConnectionManager(auditLogger);

const mcpServer = new McpServer({
  name: 'ssh-mcp-server',
  version: '1.5.0',
});

const definitions = [
  listRemoteFiles,
  uploadFile,
  downloadFile,
  deleteRemoteFile,
  executeCommand,
  listServers,
  portForward,
  closePortForward,
  listPortForwards,
  forwardService,
  executeTemplate,
  listTemplates
];

for (const def of definitions) {
  mcpServer.registerTool(
    def.name,
    {
      description: def.description,
      inputSchema: def.parameters,
    },
    async (args: any) => {
      return def.handler(args, {
        sshManager,
        configManager,
      });
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

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
