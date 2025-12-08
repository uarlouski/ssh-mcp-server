import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Builds a standardized CallToolResult with JSON-formatted text content
 * @param data - The data object to be JSON stringified
 * @returns A CallToolResult with the data formatted as pretty-printed JSON
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
