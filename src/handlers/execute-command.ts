import type { SSHConnectionManager } from '../ssh-manager.js';
import type { ConfigManager } from '../config.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface HandlerContext {
  sshManager: SSHConnectionManager;
  configManager: ConfigManager;
}

export async function handleExecuteCommand(
  args: any,
  context: HandlerContext
): Promise<CallToolResult> {
  const { connectionName, command } = args;

  const sshConfig = context.configManager.getServer(connectionName);

  if (!context.configManager.isCommandAllowed(command)) {
    throw new Error(`Command "${command}" is not in the allowed commands list`);
  }

  const result = await context.sshManager.executeCommand(sshConfig, command);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        }, null, 2),
      },
    ],
  };
}
