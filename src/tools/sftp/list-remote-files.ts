import type { ToolRegistration, HandlerContext } from '../types.js';
import { validateRequiredString } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';

interface ListRemoteFilesArgs {
  connectionName?: string;
  remotePath?: string;
  pattern?: string;
}

const definition = {
  name: 'ssh_list_remote_files',
  description:
    'List files in a remote directory via SFTP. The connectionName must reference a pre-configured SSH server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      remotePath: {
        type: 'string',
        description: 'Remote directory path to list',
      },
      pattern: {
        type: 'string',
        description: 'Optional glob pattern to filter files (e.g., "*.log", "*.json")',
      },
    },
    required: ['connectionName', 'remotePath'],
  },
};

const handler = async (args: ListRemoteFilesArgs, context: HandlerContext) => {
  const { connectionName, remotePath, pattern } = args;

  validateRequiredString(remotePath, 'remotePath');

  const sshConfig = context.configManager.getServer(connectionName);
  const result = await context.sshManager.listRemoteFiles(sshConfig, remotePath, pattern);

  const formattedFiles = result.files.map(file => ({
    name: file.filename,
    size: file.attrs.size,
    modified: new Date(file.attrs.mtime * 1000).toISOString(),
    permissions: file.attrs.mode.toString(8),
    isDirectory: (file.attrs.mode & 0o40000) !== 0,
    isFile: (file.attrs.mode & 0o100000) !== 0,
  }));

  return buildToolResult({
    remotePath,
    pattern: pattern || 'none',
    totalCount: result.totalCount,
    files: formattedFiles,
  });
};

export const listRemoteFiles = <ToolRegistration<ListRemoteFilesArgs>>{
  definition,
  handler,
};
