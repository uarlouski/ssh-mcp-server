import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './execute-command.js';
import { validateRequiredString, validatePermissions } from '../utils.js';

interface UploadFileArgs {
  connectionName?: string;
  localPath?: string;
  remotePath?: string;
  permissions?: string;
}

export async function handleUploadFile(
  args: UploadFileArgs,
  context: HandlerContext
): Promise<CallToolResult> {
  const { connectionName, localPath, remotePath, permissions } = args;

  validateRequiredString(localPath, 'localPath');
  validateRequiredString(remotePath, 'remotePath');

  if (permissions) {
    validatePermissions(permissions);
  }

  const sshConfig = context.configManager.getServer(connectionName);
  const result = await context.sshManager.uploadFile(sshConfig, localPath, remotePath, permissions);

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
          localPath,
          remotePath,
        }, null, 2),
      },
    ],
  };
}

