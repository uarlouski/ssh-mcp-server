import type { ToolRegistration, HandlerContext } from '../types.js';
import { validateRequiredString } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';

interface DownloadFileArgs {
  connectionName?: string;
  remotePath?: string;
  localPath?: string;
}

const definition = {
  name: 'ssh_download_file',
  description:
    'Download a file from remote server to local system via SFTP. The connectionName must reference a pre-configured server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path to download',
      },
      localPath: {
        type: 'string',
        description: 'Local destination path',
      },
    },
    required: ['connectionName', 'remotePath', 'localPath'],
  },
};

const handler = async (args: DownloadFileArgs, context: HandlerContext) => {
  const { connectionName, remotePath, localPath } = args;

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
};

export const downloadFile = <ToolRegistration<DownloadFileArgs>>{
  definition,
  handler,
};
