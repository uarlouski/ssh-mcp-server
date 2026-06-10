import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { restartPortForward } from '../../tools/port-forward/restart-port-forward.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleRestartPortForward', () => {
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
            restartPortForward: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully restart an active port forward by ID', async () => {
        const forwards = [
            {
                id: 'forward-id-123',
                sshHost: 'db.example.com',
                sshPort: 22,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);
        mockSSHManager.restartPortForward.mockResolvedValue({
            id: 'forward-id-123',
            localPort: 5432,
            status: 'active',
        });

        const result = await restartPortForward.handler(
            { id: 'forward-id-123' },
            context
        );

        expect(mockSSHManager.listPortForwards).toHaveBeenCalled();
        expect(mockSSHManager.restartPortForward).toHaveBeenCalledWith('forward-id-123');

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.id).toBe('forward-id-123');
        expect(response.localPort).toBe(5432);
        expect(response.message).toContain('restarted');
    });

    it('should throw error when no matching port forward is found', async () => {
        const forwards = [
            {
                id: 'other-id',
                sshHost: 'another.example.com',
                sshPort: 22,
                sshUsername: 'user',
                localPort: 3000,
                remoteHost: 'localhost',
                remotePort: 8080,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        await expect(
            restartPortForward.handler(
                { id: 'non-existent-id' },
                context
            )
        ).rejects.toThrow('No active port forward found with ID: non-existent-id');
    });

    it('should propagate errors from restartPortForward method', async () => {
        const forwards = [
            {
                id: 'forward-id-123',
                sshHost: 'db.example.com',
                sshPort: 22,
                sshUsername: 'admin',
                localPort: 5432,
                remoteHost: 'db-internal',
                remotePort: 5432,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);
        mockSSHManager.restartPortForward.mockRejectedValue(new Error('Restart failed'));

        await expect(
            restartPortForward.handler(
                { id: 'forward-id-123' },
                context
            )
        ).rejects.toThrow('Restart failed');
    });
});
