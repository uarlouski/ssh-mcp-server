import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { downloadFile } from '../../tools/sftp/download-file.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleDownloadFile', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            downloadFile: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully download a file with bytes transferred', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const downloadResult = {
            success: true,
            bytesTransferred: 1024,
            message: 'File downloaded successfully',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.downloadFile.mockResolvedValue(downloadResult);

        const result = await downloadFile.handler(
            {
                connectionName: 'production',
                remotePath: '/var/log/app.log',
                localPath: '/tmp/app.log',
            },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production');
        expect(mockSSHManager.downloadFile).toHaveBeenCalledWith(
            sshConfig,
            '/var/log/app.log',
            '/tmp/app.log'
        );

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.bytesTransferred).toBe(1024);
        expect(response.message).toBe('File downloaded successfully');
        expect(response.remotePath).toBe('/var/log/app.log');
        expect(response.localPath).toBe('/tmp/app.log');
    });

    it('should throw validation error when remotePath is missing', async () => {
        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: undefined,
                    localPath: '/tmp/app.log',
                },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when localPath is missing', async () => {
        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: '/var/log/app.log',
                    localPath: undefined,
                },
                context
            )
        ).rejects.toThrow('localPath is required and must be a non-empty string');
    });

    it('should throw validation error when remotePath is empty string', async () => {
        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: '   ',
                    localPath: '/tmp/app.log',
                },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when localPath is empty string', async () => {
        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: '/var/log/app.log',
                    localPath: '   ',
                },
                context
            )
        ).rejects.toThrow('localPath is required and must be a non-empty string');
    });

    it('should throw error when download fails', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const downloadResult = {
            success: false,
            bytesTransferred: 0,
            message: 'Remote file not found',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.downloadFile.mockResolvedValue(downloadResult);

        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: '/var/log/nonexistent.log',
                    localPath: '/tmp/app.log',
                },
                context
            )
        ).rejects.toThrow('Remote file not found');
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            downloadFile.handler(
                {
                    connectionName: 'nonexistent',
                    remotePath: '/var/log/app.log',
                    localPath: '/tmp/app.log',
                },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should propagate SSH manager errors', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.downloadFile.mockRejectedValue(new Error('Disk full'));

        await expect(
            downloadFile.handler(
                {
                    connectionName: 'production',
                    remotePath: '/var/log/app.log',
                    localPath: '/tmp/app.log',
                },
                context
            )
        ).rejects.toThrow('Disk full');
    });
});
