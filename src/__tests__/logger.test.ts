import { AuditLogger } from '../logger.js';
import { appendFile } from 'fs/promises';
import { join } from 'path';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  appendFile: jest.fn(),
}));

describe('AuditLogger', () => {
  const mockLogDir = '/mock/log/dir';
  let logger: AuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when disabled', () => {
    beforeEach(() => {
      logger = new AuditLogger(false, mockLogDir);
    });

    it('should not write to file', async () => {
      const entry = {
        sessionId: 'test-session-id',
        timestamp: '2023-01-01T00:00:00.000Z',
        connectionName: 'user@host',
        command: 'ls',
        exitCode: 0,
        durationMs: 100
      };

      await logger.log(entry);

      expect(appendFile).not.toHaveBeenCalled();
    });
  });

  describe('when enabled', () => {
    beforeEach(() => {
      logger = new AuditLogger(true, mockLogDir);
    });

    it('should write log entry to file', async () => {
      const entry = {
        sessionId: 'test-session-id',
        timestamp: '2023-01-01T00:00:00.000Z',
        connectionName: 'user@host',
        command: 'ls',
        exitCode: 0,
        durationMs: 100
      };

      await logger.log(entry);

      const expectedFilename = 'audit-user_host-test-session-id.jsonl';
      const expectedPath = join(mockLogDir, expectedFilename);
      const expectedContent = JSON.stringify(entry) + '\n';

      expect(appendFile).toHaveBeenCalledWith(expectedPath, expectedContent, 'utf-8');
    });

    it('should sanitize connection name in filename', async () => {
      const entry = {
        sessionId: 'session-123',
        timestamp: '2023-01-01T00:00:00.000Z',
        connectionName: 'complicated/user:name@host!',
        command: 'ls',
        exitCode: 0,
        durationMs: 100
      };

      await logger.log(entry);

      // Special chars should be replaced by underscores
      const expectedFilename = 'audit-complicated_user_name_host_-session-123.jsonl';
      const expectedPath = join(mockLogDir, expectedFilename);

      expect(appendFile).toHaveBeenCalledWith(expectedPath, expect.any(String), 'utf-8');
    });

    it('should handle appendFile errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Write failed');
      (appendFile as jest.Mock).mockRejectedValueOnce(error);

      const entry = {
        sessionId: 'session-123',
        timestamp: '2023-01-01T00:00:00.000Z',
        connectionName: 'user@host',
        command: 'ls',
        exitCode: 0,
        durationMs: 100
      };

      await expect(logger.log(entry)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(`Failed to write to audit log: ${error}`);

      consoleSpy.mockRestore();
    });
  });
});
