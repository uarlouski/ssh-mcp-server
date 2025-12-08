import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { closePortForward } from '../../tools/port-forward/close-port-forward.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleClosePortForward', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            listPortForwards: jest.fn(),
            closePortForward: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully close an active port forward', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwards = [
            {
                sshHost: 'db.example.com',
                sshPort: 22,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
        ];

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listPortForwards.mockReturnValue(forwards);
        mockSSHManager.closePortForward.mockResolvedValue(undefined);

        const result = await closePortForward.handler(
            { connectionName: 'production-db', localPort: 5432 },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production-db');
        expect(mockSSHManager.listPortForwards).toHaveBeenCalled();
        expect(mockSSHManager.closePortForward).toHaveBeenCalledWith(
            sshConfig,
            5432,
            'db-internal',
            5432
        );

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.message).toContain('localhost:5432');
        expect(response.message).toContain('db-internal:5432');
    });

    it('should throw error when no matching port forward is found', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwards = [
            {
                sshHost: 'another.example.com',
                sshPort: 22,
                sshUsername: 'user',
                localPort: 3000,
                remoteHost: 'localhost',
                remotePort: 8080,
                status: 'active' as const,
            },
        ];

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        await expect(
            closePortForward.handler(
                { connectionName: 'production-db', localPort: 5432 },
                context
            )
        ).rejects.toThrow('No active port forward found for production-db on local port 5432');
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            closePortForward.handler(
                { connectionName: 'nonexistent', localPort: 5432 },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should correctly match port forward by SSH config and local port', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 2222,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwards = [
            {
                sshHost: 'db.example.com',
                sshPort: 22,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
            {
                sshHost: 'db.example.com',
                sshPort: 2222,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
        ];

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listPortForwards.mockReturnValue(forwards);
        mockSSHManager.closePortForward.mockResolvedValue(undefined);

        const result = await closePortForward.handler(
            { connectionName: 'production-db', localPort: 5432 },
            context
        );

        expect(mockSSHManager.closePortForward).toHaveBeenCalledWith(
            sshConfig,
            5432,
            'db-internal',
            5432
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
    });

    it('should propagate errors from closePortForward method', async () => {
        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        const forwards = [
            {
                sshHost: 'db.example.com',
                sshPort: 22,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
        ];

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listPortForwards.mockReturnValue(forwards);
        mockSSHManager.closePortForward.mockRejectedValue(new Error('Connection timeout'));

        await expect(
            closePortForward.handler(
                { connectionName: 'production-db', localPort: 5432 },
                context
            )
        ).rejects.toThrow('Connection timeout');
    });
});
