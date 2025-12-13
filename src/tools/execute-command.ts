import type { ToolRegistration, HandlerContext } from './types.js';
import { buildToolResult } from './response-builder.js';

interface ExecuteCommandArgs {
  connectionName: string;
  command: string;
  commandTimeout?: number;
}

const definition = {
  name: 'ssh_execute_command',
  description:
    'Execute a command on a remote SSH server. The connectionName must reference a pre-configured server in config.json.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      command: {
        type: 'string',
        description: 'Command to execute on the remote server',
      },
      commandTimeout: {
        type: 'number',
        description: 'Optional command execution timeout in milliseconds (overrides global commandTimeout)',
      },
    },
    required: ['connectionName', 'command'],
  },
};

const handler = async (args: ExecuteCommandArgs, context: HandlerContext) => {
  const { connectionName, command, commandTimeout } = args;

  const sshConfig = context.configManager.getServer(connectionName);

  if (!context.configManager.isCommandAllowed(command)) {
    throw new Error(`Command "${command}" is not in the allowed commands list`);
  }

  const effectiveTimeout = commandTimeout ?? context.configManager.getCommandTimeout();
  const result = await context.sshManager.executeCommand(sshConfig, command, effectiveTimeout);

  return buildToolResult({
    success: true,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut === true,
  });
};

export const executeCommand = <ToolRegistration<ExecuteCommandArgs>>{
  definition,
  handler,
};
