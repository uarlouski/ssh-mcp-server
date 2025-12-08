import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from '../../tools/types.js';
import type { HandlerContext } from '../types.js';
import { validateRequiredString } from '../../utils.js';
import { buildToolResult } from '../response-builder.js';

interface DeleteRemoteFileArgs {
  connectionName?: string;
  remotePath?: string;
}

const definition: Tool = {
  name: 'ssh_delete_remote_file',
  description:
    'Delete a file on the remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      remotePath: {
        type: 'string',
        description: 'Remote file path to delete',
      },
    },
    required: ['connectionName', 'remotePath'],
  },
};

const handler = async (args: DeleteRemoteFileArgs, context: HandlerContext): Promise<CallToolResult> => {
  const { connectionName, remotePath } = args;

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
};

export const deleteRemoteFile = <ToolRegistration<DeleteRemoteFileArgs>>{
  definition,
  handler,
};
