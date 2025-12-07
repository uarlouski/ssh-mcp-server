import type { HandlerContext } from './index.js';
import { substituteVariables } from '../template-processor.js';

interface ExecuteTemplateArgs {
  connectionName: string;
  templateName: string;
  variables?: Record<string, string>;
}

export async function handleExecuteTemplate(
  args: ExecuteTemplateArgs,
  context: HandlerContext
) {
  const { connectionName, templateName, variables } = args;

  if (!connectionName) {
    throw new Error('connectionName is required');
  }

  if (!templateName) {
    throw new Error('templateName is required');
  }

  const template = context.configManager.getCommandTemplate(templateName);

  const command = substituteVariables(template, variables);

  if (!context.configManager.isCommandAllowed(command)) {
    throw new Error(
      `Command not allowed. The expanded command '${command}' is not in the allowedCommands list.`
    );
  }

  const sshConfig = context.configManager.getServer(connectionName);
  const result = await context.sshManager.executeCommand(sshConfig, command);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            templateName,
            expandedCommand: command,
            variables: variables || {},
            result: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

