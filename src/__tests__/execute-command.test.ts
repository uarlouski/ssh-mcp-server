import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleExecuteCommand } from '../handlers/execute-command.js';
import { ConfigManager } from '../config.js';
import { SSHConnectionManager } from '../ssh-manager.js';
import type { HandlerContext } from '../handlers/execute-command.js';

jest.mock('../config.js');
jest.mock('../ssh-manager.js');

describe('handleExecuteCommand', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
            isCommandAllowed: jest.fn(),
        } as any;

        mockSSHManager = {
            executeCommand: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully execute an allowed command', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const commandResult = {
            exitCode: 0,
            stdout: 'Command output',
            stderr: '',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockConfigManager.isCommandAllowed.mockReturnValue(true);
        mockSSHManager.executeCommand.mockResolvedValue(commandResult);

        const result = await handleExecuteCommand(
            { connectionName: 'production', command: 'ls -la' },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production');
        expect(mockConfigManager.isCommandAllowed).toHaveBeenCalledWith('ls -la');
        expect(mockSSHManager.executeCommand).toHaveBeenCalledWith(sshConfig, 'ls -la');

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.exitCode).toBe(0);
        expect(response.stdout).toBe('Command output');
        expect(response.stderr).toBe('');
    });

    it('should throw error when command is not in allowed list', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockConfigManager.isCommandAllowed.mockReturnValue(false);

        await expect(
            handleExecuteCommand(
                { connectionName: 'production', command: 'rm -rf /' },
                context
            )
        ).rejects.toThrow('Command "rm -rf /" is not in the allowed commands list');

        expect(mockSSHManager.executeCommand).not.toHaveBeenCalled();
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            handleExecuteCommand(
                { connectionName: 'nonexistent', command: 'ls' },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should handle non-zero exit codes', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const commandResult = {
            exitCode: 1,
            stdout: '',
            stderr: 'Command failed',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockConfigManager.isCommandAllowed.mockReturnValue(true);
        mockSSHManager.executeCommand.mockResolvedValue(commandResult);

        const result = await handleExecuteCommand(
            { connectionName: 'production', command: 'false' },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.exitCode).toBe(1);
        expect(response.stderr).toBe('Command failed');
    });

    it('should handle commands with both stdout and stderr', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const commandResult = {
            exitCode: 0,
            stdout: 'Standard output',
            stderr: 'Warning message',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockConfigManager.isCommandAllowed.mockReturnValue(true);
        mockSSHManager.executeCommand.mockResolvedValue(commandResult);

        const result = await handleExecuteCommand(
            { connectionName: 'production', command: 'echo test' },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.stdout).toBe('Standard output');
        expect(response.stderr).toBe('Warning message');
    });

    it('should propagate SSH manager errors', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockConfigManager.isCommandAllowed.mockReturnValue(true);
        mockSSHManager.executeCommand.mockRejectedValue(new Error('Connection timeout'));

        await expect(
            handleExecuteCommand(
                { connectionName: 'production', command: 'ls' },
                context
            )
        ).rejects.toThrow('Connection timeout');
    });
});
