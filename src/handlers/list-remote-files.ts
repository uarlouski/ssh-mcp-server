import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './execute-command.js';
import { validateRequiredString } from '../utils.js';

interface ListRemoteFilesArgs {
  connectionName?: string;
  remotePath?: string;
  pattern?: string;
}

export async function handleListRemoteFiles(
  args: ListRemoteFilesArgs,
  context: HandlerContext
): Promise<CallToolResult> {
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

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          remotePath,
          pattern: pattern || 'none',
          totalCount: result.totalCount,
          files: formattedFiles,
        }, null, 2),
      },
    ],
  };
}

