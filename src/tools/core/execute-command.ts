import type { HandlerContext, ToolDefinition } from '../types.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  command: z.string().describe('Command to execute on the remote server'),
  commandTimeout: z.number().optional().describe('Optional command execution timeout in milliseconds (overrides global commandTimeout)'),
};

export const executeCommand: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_execute_command',
  description:
    'Execute a command on a remote SSH server. The connectionName must reference a pre-configured server in config.json.',
  parameters,
  handler: async ({ connectionName, command, commandTimeout }, context) => {
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
  }
};
