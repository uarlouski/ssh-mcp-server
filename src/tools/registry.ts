import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolRegistration } from './types.js';

// Core
import { executeCommand } from './execute-command.js';

// Port Forward
import { portForward } from './port-forward/port-forward.js';
import { closePortForward } from './port-forward/close-port-forward.js';
import { listPortForwards } from './port-forward/list-port-forwards.js';
import { forwardService } from './port-forward/forward-service.js';

// SFTP
import { uploadFile } from './sftp/upload-file.js';
import { downloadFile } from './sftp/download-file.js';
import { listRemoteFiles } from './sftp/list-remote-files.js';
import { deleteRemoteFile } from './sftp/delete-remote-file.js';

// Templates
import { executeTemplate } from './templates/execute-template.js';
import { listTemplates } from './templates/list-templates.js';

const registrations: ToolRegistration[] = [
  executeCommand,
  portForward,
  forwardService,
  closePortForward,
  listPortForwards,
  uploadFile,
  downloadFile,
  listRemoteFiles,
  deleteRemoteFile,
  executeTemplate,
  listTemplates,
];

/**
 * Tool definitions for MCP ListTools request.
 */
export const tools: Tool[] = registrations.map(r => r.definition);

export const handlers: Map<string, ToolRegistration['handler']> = new Map(
  registrations.map(r => [r.definition.name, r.handler])
);
