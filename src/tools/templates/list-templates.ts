import type { HandlerContext, ToolDefinition } from '../types.js';
import { extractVariables } from '../../template-processor.js';
import { buildToolResult } from '../response-builder.js';
import z from 'zod';

const parameters = {};

export const listTemplates: ToolDefinition<typeof parameters, HandlerContext> = {
  name: 'ssh_list_templates',
  description:
    'List all available command templates defined in config.json with their descriptions and required variables.',
  parameters,
  handler: async (_args, context) => {
    const templates = context.configManager.listCommandTemplates();

    return buildToolResult({
      success: true,
      templates: templates.map(t => ({
        name: t.name,
        command: t.command,
        description: t.description || 'No description provided',
        variables: extractVariables(t.command),
      })),
      count: templates.length,
    });
  }
};
