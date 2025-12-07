import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleDeleteRemoteFile } from '../handlers/delete-remote-file.js';
import { ConfigManager } from '../config.js';
import { SSHConnectionManager } from '../ssh-manager.js';
import type { HandlerContext } from '../handlers/execute-command.js';

jest.mock('../config.js');
jest.mock('../ssh-manager.js');

describe('handleDeleteRemoteFile', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            deleteRemoteFile: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully delete a remote file', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const deleteResult = {
            success: true,
            message: 'File deleted successfully',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.deleteRemoteFile.mockResolvedValue(deleteResult);

        const result = await handleDeleteRemoteFile(
            { connectionName: 'production', remotePath: '/tmp/file.txt' },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production');
        expect(mockSSHManager.deleteRemoteFile).toHaveBeenCalledWith(sshConfig, '/tmp/file.txt');

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.message).toBe('File deleted successfully');
        expect(response.remotePath).toBe('/tmp/file.txt');
    });

    it('should throw validation error when remotePath is missing', async () => {
        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'production', remotePath: undefined },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when remotePath is empty string', async () => {
        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'production', remotePath: '   ' },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when remotePath is not a string', async () => {
        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'production', remotePath: 123 as any },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw error when deletion fails', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const deleteResult = {
            success: false,
            message: 'File not found',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.deleteRemoteFile.mockResolvedValue(deleteResult);

        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'production', remotePath: '/tmp/nonexistent.txt' },
                context
            )
        ).rejects.toThrow('File not found');
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'nonexistent', remotePath: '/tmp/file.txt' },
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
        mockSSHManager.deleteRemoteFile.mockRejectedValue(new Error('Connection refused'));

        await expect(
            handleDeleteRemoteFile(
                { connectionName: 'production', remotePath: '/tmp/file.txt' },
                context
            )
        ).rejects.toThrow('Connection refused');
    });
});
