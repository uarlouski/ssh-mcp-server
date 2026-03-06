import type { HandlerContext, ToolDefinition } from '../types.js';
import { substituteVariables } from '../../template-processor.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {
  connectionName: z.string().describe('Name of a pre-configured SSH server from config.json'),
  templateName: z.string().describe('Name of the command template defined in config.json'),
  variables: z.record(z.string(), z.string()).optional().describe('Key-value pairs for template variable substitution'),
  commandTimeout: z.number().optional().describe('Optional command execution timeout in milliseconds (overrides global commandTimeout)'),
};

export const executeTemplate: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_execute_template',
  description:
    'Execute a pre-configured command template with variable substitution. Templates are defined in the commandTemplates section of config.json and support ${variable} and ${variable:-defaultValue} syntax.',
  parameters,
  handler: async ({ connectionName, templateName, variables, commandTimeout }, context) => {
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
  }
};
