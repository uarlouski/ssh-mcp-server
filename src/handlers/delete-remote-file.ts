import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HandlerContext } from './execute-command.js';
import { validateRequiredString } from '../utils.js';

interface DeleteRemoteFileArgs {
  connectionName?: string;
  remotePath?: string;
}

export async function handleDeleteRemoteFile(
  args: DeleteRemoteFileArgs,
  context: HandlerContext
): Promise<CallToolResult> {
  const { connectionName, remotePath } = args;

  validateRequiredString(remotePath, 'remotePath');

  const sshConfig = context.configManager.getServer(connectionName);
  const result = await context.sshManager.deleteRemoteFile(sshConfig, remotePath);

  if (!result.success) {
    throw new Error(result.message);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          message: result.message,
          remotePath,
        }, null, 2),
      },
    ],
  };
}

