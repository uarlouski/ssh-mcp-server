import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Builds a standardized CallToolResult with JSON-formatted text content.
 */
export function buildToolResult(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
