import type { ToolRegistration, HandlerContext } from '../types.js';
import { validateRequiredString, validatePermissions } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';

interface UploadFileArgs {
  connectionName?: string;
  localPath?: string;
  remotePath?: string;
  permissions?: string;
}

const definition = {
  name: 'ssh_upload_file',
  description:
    'Upload a file from local system to remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      localPath: {
        type: 'string',
        description: 'Local file path to upload',
      },
      remotePath: {
        type: 'string',
        description: 'Remote destination path',
      },
      permissions: {
        type: 'string',
        description: 'Optional file permissions in octal format (e.g., "0644", "0755")',
      },
    },
    required: ['connectionName', 'localPath', 'remotePath'],
  },
};

const handler = async (args: UploadFileArgs, context: HandlerContext) => {
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

  return buildToolResult({
    success: result.success,
    bytesTransferred: result.bytesTransferred,
    message: result.message,
    localPath,
    remotePath,
  });
};

export const uploadFile = <ToolRegistration<UploadFileArgs>>{
  definition,
  handler,
};
