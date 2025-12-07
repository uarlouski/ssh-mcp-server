import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handlePortForward } from '../handlers/port-forward.js';
import { ConfigManager } from '../config.js';
import { SSHConnectionManager } from '../ssh-manager.js';
import type { HandlerContext } from '../handlers/execute-command.js';

jest.mock('../config.js');
jest.mock('../ssh-manager.js');

describe('handlePortForward', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            setupPortForward: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully setup port forward with explicit local port', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 5432,
            status: 'active',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await handlePortForward(
            {
                connectionName: 'production-db',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
            },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production-db');
        expect(mockSSHManager.setupPortForward).toHaveBeenCalledWith(
            sshConfig,
            5432,
            'db-internal',
            5432
        );

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.localPort).toBe(5432);
        expect(response.remoteHost).toBe('db-internal');
        expect(response.remotePort).toBe(5432);
        expect(response.status).toBe('active');
        expect(response.message).toBe('Port forwarding active: localhost:5432 -> db-internal:5432');
    });

    it('should successfully setup port forward with dynamic port allocation', async () => {
        const sshConfig = {
            host: 'app.example.com',
            port: 22,
            username: 'deployer',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 12345,
            status: 'active',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await handlePortForward(
            {
                connectionName: 'staging-app',
                remoteHost: 'localhost',
                remotePort: 8080,
            },
            context
        );

        expect(mockSSHManager.setupPortForward).toHaveBeenCalledWith(
            sshConfig,
            0,
            'localhost',
            8080
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.localPort).toBe(12345);
        expect(response.status).toBe('active');
        expect(response.message).toBe('Port forwarding active: localhost:12345 -> localhost:8080');
    });

    it('should use localPort 0 by default when not specified', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 54321,
            status: 'active',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        await handlePortForward(
            {
                connectionName: 'server',
                remoteHost: 'service',
                remotePort: 3000,
            },
            context
        );

        expect(mockSSHManager.setupPortForward).toHaveBeenCalledWith(
            sshConfig,
            0,
            'service',
            3000
        );
    });

    it('should handle already_active status', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 5432,
            status: 'already_active',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await handlePortForward(
            {
                connectionName: 'production-db',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
            },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.status).toBe('already_active');
        expect(response.localPort).toBe(5432);
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            handlePortForward(
                {
                    connectionName: 'nonexistent',
                    localPort: 5432,
                    remoteHost: 'localhost',
                    remotePort: 3000,
                },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should propagate errors from setupPortForward method', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockRejectedValue(new Error('Port already in use'));

        await expect(
            handlePortForward(
                {
                    connectionName: 'production-db',
                    localPort: 5432,
                    remoteHost: 'db-internal',
                    remotePort: 5432,
                },
                context
            )
        ).rejects.toThrow('Port already in use');
    });

    it('should handle different remote hosts', async () => {
        const sshConfig = {
            host: 'gateway.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 9000,
            status: 'active',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await handlePortForward(
            {
                connectionName: 'gateway',
                localPort: 9000,
                remoteHost: 'internal-api.local',
                remotePort: 443,
            },
            context
        );

        expect(mockSSHManager.setupPortForward).toHaveBeenCalledWith(
            sshConfig,
            9000,
            'internal-api.local',
            443
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.message).toBe('Port forwarding active: localhost:9000 -> internal-api.local:443');
    });
});
