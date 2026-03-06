import type { HandlerContext, ToolDefinition } from '../types.js';
import { validateRequiredString, validatePermissions } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  localPath: z.string().describe('Local file path to upload'),
  remotePath: z.string().describe('Remote destination path'),
  permissions: z.string().optional().describe('Optional file permissions in octal format (e.g., "0644", "0755")'),
};

export const uploadFile: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_upload_file',
  description:
    'Upload a file from local system to remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
  parameters,
  handler: async ({ connectionName, localPath, remotePath, permissions }, context) => {
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

    return buildToolResult({
      success: result.success,
      bytesTransferred: result.bytesTransferred,
      message: result.message,
      localPath,
      remotePath,
    });
  }
};
