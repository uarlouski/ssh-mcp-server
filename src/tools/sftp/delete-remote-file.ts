import type { HandlerContext, ToolDefinition } from '../types.js';
import { validateRequiredString } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  remotePath: z.string().describe('Remote file path to delete'),
};

export const deleteRemoteFile: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_delete_remote_file',
  description:
    'Delete a file on the remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
  parameters,
  handler: async ({ connectionName, remotePath }, context) => {
    validateRequiredString(remotePath, 'remotePath');

    const sshConfig = context.configManager.getServer(connectionName);
    const result = await context.sshManager.deleteRemoteFile(sshConfig, remotePath);

    if (!result.success) {
      throw new Error(result.message);
    }

    return buildToolResult({
      success: result.success,
      message: result.message,
      remotePath,
    });
  }
};
