import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './execute-command.js';
import { validateRequiredString } from '../utils.js';

interface DownloadFileArgs {
  connectionName?: string;
  remotePath?: string;
  localPath?: string;
}

export async function handleDownloadFile(
  args: DownloadFileArgs,
  context: HandlerContext
): Promise<CallToolResult> {
  const { connectionName, remotePath, localPath } = args;

  validateRequiredString(remotePath, 'remotePath');
  validateRequiredString(localPath, 'localPath');

  const sshConfig = context.configManager.getServer(connectionName);
  const result = await context.sshManager.downloadFile(sshConfig, remotePath, localPath);

  if (!result.success) {
    throw new Error(result.message);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          bytesTransferred: result.bytesTransferred,
          message: result.message,
          remotePath,
          localPath,
        }, null, 2),
      },
    ],
  };
}

