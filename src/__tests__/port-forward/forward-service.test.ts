import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { forwardService } from '../../tools/port-forward/forward-service.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleForwardService', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getPortForwardingService: jest.fn(),
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

    it('should start a named service with explicit local port', async () => {
        const serviceConfig = {
            connectionName: 'production-db',
            localPort: 5432,
            remoteHost: 'db-internal',
            remotePort: 5432,
            description: 'Production database',
        };

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

        mockConfigManager.getPortForwardingService.mockReturnValue(serviceConfig);
        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await forwardService.handler(
            { serviceName: 'production-database' },
            context
        );

        expect(mockConfigManager.getPortForwardingService).toHaveBeenCalledWith('production-database');
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
        expect(response.serviceName).toBe('production-database');
        expect(response.localPort).toBe(5432);
        expect(response.status).toBe('active');
        expect(response.description).toBe('Production database');
    });

    it('should start a named service with dynamic port allocation', async () => {
        const serviceConfig = {
            connectionName: 'staging-app',
            remoteHost: 'localhost',
            remotePort: 8080,
            description: 'Staging API',
        };

        const sshConfig = {
            host: 'staging.example.com',
            port: 22,
            username: 'deployer',
            privateKeyPath: '/path/to/key',
        };

        const forwardResult = {
            localPort: 12345,
            status: 'active',
        };

        mockConfigManager.getPortForwardingService.mockReturnValue(serviceConfig);
        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await forwardService.handler(
            { serviceName: 'staging-api' },
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
    });

    it('should handle already_active status', async () => {
        const serviceConfig = {
            connectionName: 'production-db',
            localPort: 5432,
            remoteHost: 'db-internal',
            remotePort: 5432,
        };

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

        mockConfigManager.getPortForwardingService.mockReturnValue(serviceConfig);
        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockResolvedValue(forwardResult);

        const result = await forwardService.handler(
            { serviceName: 'production-database' },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.status).toBe('already_active');
    });

    it('should throw error when service not found', async () => {
        mockConfigManager.getPortForwardingService.mockImplementation(() => {
            throw new Error("Port forwarding service 'nonexistent' not found in config.json");
        });

        await expect(
            forwardService.handler({ serviceName: 'nonexistent' }, context)
        ).rejects.toThrow("Port forwarding service 'nonexistent' not found in config.json");
    });

    it('should throw error when server not found', async () => {
        const serviceConfig = {
            connectionName: 'nonexistent-server',
            remoteHost: 'localhost',
            remotePort: 3000,
        };

        mockConfigManager.getPortForwardingService.mockReturnValue(serviceConfig);
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent-server' not found in config.json");
        });

        await expect(
            forwardService.handler({ serviceName: 'test-service' }, context)
        ).rejects.toThrow("Server configuration 'nonexistent-server' not found in config.json");
    });

    it('should propagate port forward setup errors', async () => {
        const serviceConfig = {
            connectionName: 'production-db',
            localPort: 5432,
            remoteHost: 'db-internal',
            remotePort: 5432,
        };

        const sshConfig = {
            host: 'db.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getPortForwardingService.mockReturnValue(serviceConfig);
        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.setupPortForward.mockRejectedValue(new Error('Port already in use'));

        await expect(
            forwardService.handler({ serviceName: 'production-database' }, context)
        ).rejects.toThrow('Port already in use');
    });
});
