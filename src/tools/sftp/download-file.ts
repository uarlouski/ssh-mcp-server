import type { HandlerContext, ToolDefinition } from '../types.js';
import { validateRequiredString } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  remotePath: z.string().describe('Remote file path to download'),
  localPath: z.string().describe('Local destination path'),
};

export const downloadFile: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_download_file',
  description:
    'Download a file from remote server to local system via SFTP. The connectionName must reference a pre-configured server in config.json.',
  parameters,
  handler: async ({ connectionName, remotePath, localPath }, context) => {
    validateRequiredString(remotePath, 'remotePath');
    validateRequiredString(localPath, 'localPath');

    const sshConfig = context.configManager.getServer(connectionName);
    const result = await context.sshManager.downloadFile(sshConfig, remotePath, localPath);

    if (!result.success) {
      throw new Error(result.message);
    }

    return buildToolResult({
      success: result.success,
      bytesTransferred: result.bytesTransferred,
      message: result.message,
      remotePath,
      localPath,
    });
  }
};
