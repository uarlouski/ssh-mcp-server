import type { HandlerContext } from '../types.js';
import { extractVariables } from '../../template-processor.js';
import { buildToolResult } from '../response-builder.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from '../../tools/types.js';

const definition: Tool = {
  name: 'ssh_list_templates',
  description:
    'List all available command templates defined in config.json with their descriptions and required variables.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const handler = async (_args: any, context: HandlerContext) => {
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
};

export const listTemplates = <ToolRegistration>{
  definition,
  handler,
};
