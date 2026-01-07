import { appendFile } from 'fs/promises';
import { join } from 'path';
import type { AuditLogEntry } from './types.js';

export class AuditLogger {
  private enabled: boolean;
  private logDir: string;

  constructor(enabled: boolean, logDir: string) {
    this.enabled = enabled;
    this.logDir = logDir;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const safeConnectionName = entry.connectionName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `audit-${safeConnectionName}-${entry.sessionId}.jsonl`;
      const logPath = join(this.logDir, filename);

      const logLine = JSON.stringify(entry) + '\n';

      await appendFile(logPath, logLine, 'utf-8');
    } catch (error) {
      console.error(`Failed to write to audit log: ${error}`);
    }
  }
}
