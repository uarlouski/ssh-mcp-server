import type { HandlerContext } from './index.js';
import { extractVariables } from '../template-processor.js';

export async function handleListTemplates(
  args: any,
  context: HandlerContext
) {
  const templates = context.configManager.listCommandTemplates();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            templates: templates.map(t => ({
              name: t.name,
              command: t.command,
              description: t.description || 'No description provided',
              variables: extractVariables(t.command),
            })),
            count: templates.length,
          },
          null,
          2
        ),
      },
    ],
  };
}

