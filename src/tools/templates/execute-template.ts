import type { HandlerContext } from '../types.js';
import { substituteVariables } from '../../template-processor.js';
import { buildToolResult } from '../response-builder.js';
import type { ToolRegistration } from '../types.js';

interface ExecuteTemplateArgs {
  connectionName: string;
  templateName: string;
  variables?: Record<string, string>;
  commandTimeout?: number;
}

const definition = {
  name: 'ssh_execute_template',
  description:
    'Execute a pre-configured command template with variable substitution. Templates are defined in the commandTemplates section of config.json and support ${variable} and ${variable:-defaultValue} syntax.',
  inputSchema: {
    type: 'object',
    properties: {
      connectionName: {
        type: 'string',
        description: 'Name of a pre-configured SSH server from config.json',
      },
      templateName: {
        type: 'string',
        description: 'Name of the command template defined in config.json',
      },
      variables: {
        type: 'object',
        description: 'Key-value pairs for template variable substitution',
        additionalProperties: {
          type: 'string',
        },
      },
      commandTimeout: {
        type: 'number',
        description: 'Optional command execution timeout in milliseconds (overrides global commandTimeout)',
      },
    },
    required: ['connectionName', 'templateName'],
  },
};

const handler = async (args: ExecuteTemplateArgs, context: HandlerContext) => {
  const { connectionName, templateName, variables, commandTimeout } = args;

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
  const effectiveTimeout = commandTimeout ?? context.configManager.getCommandTimeout();
  const result = await context.sshManager.executeCommand(sshConfig, command, effectiveTimeout);

  return buildToolResult({
    success: true,
    templateName,
    expandedCommand: command,
    variables: variables || {},
    result: {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut === true,
    },
  });
};

export const executeTemplate = <ToolRegistration<ExecuteTemplateArgs>>{
  definition,
  handler,
};
