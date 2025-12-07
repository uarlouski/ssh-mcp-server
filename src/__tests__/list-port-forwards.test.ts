import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleListPortForwards } from '../handlers/list-port-forwards.js';
import { ConfigManager } from '../config.js';
import { SSHConnectionManager } from '../ssh-manager.js';
import type { HandlerContext } from '../handlers/execute-command.js';

jest.mock('../config.js');
jest.mock('../ssh-manager.js');

describe('handleListPortForwards', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {} as any;

        mockSSHManager = {
            listPortForwards: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should list multiple active port forwards', async () => {
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
                sshHost: 'app.example.com',
                sshPort: 22,
                sshUsername: 'deployer',
                localPort: 8080,
                remoteHost: 'localhost',
                remotePort: 3000,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        const result = await handleListPortForwards({}, context);

        expect(mockSSHManager.listPortForwards).toHaveBeenCalled();
        expect(result.content[0].type).toBe('text');

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.count).toBe(2);
        expect(response.forwards).toHaveLength(2);

        expect(response.forwards[0].sshConnection).toBe('admin@db.example.com:22');
        expect(response.forwards[0].tunnel).toBe('localhost:5432 -> db-internal:5432');
        expect(response.forwards[0].status).toBe('active');

        expect(response.forwards[1].sshConnection).toBe('deployer@app.example.com:22');
        expect(response.forwards[1].tunnel).toBe('localhost:8080 -> localhost:3000');
        expect(response.forwards[1].status).toBe('active');
    });

    it('should list when no port forwards are active', async () => {
        mockSSHManager.listPortForwards.mockReturnValue([]);

        const result = await handleListPortForwards({}, context);

        expect(mockSSHManager.listPortForwards).toHaveBeenCalled();
        expect(result.content[0].type).toBe('text');

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.count).toBe(0);
        expect(response.forwards).toEqual([]);
    });

    it('should properly format SSH connection string', async () => {
        const forwards = [
            {
                sshHost: 'special-host.com',
                sshPort: 2222,
                sshUsername: 'special-user',
                localPort: 9000,
                remoteHost: 'internal-service',
                remotePort: 80,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        const result = await handleListPortForwards({}, context);

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.forwards[0].sshConnection).toBe('special-user@special-host.com:2222');
    });

    it('should properly format tunnel string', async () => {
        const forwards = [
            {
                sshHost: 'gateway.example.com',
                sshPort: 22,
                sshUsername: 'user',
                localPort: 12345,
                remoteHost: 'backend-service',
                remotePort: 8888,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        const result = await handleListPortForwards({}, context);

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.forwards[0].tunnel).toBe('localhost:12345 -> backend-service:8888');
    });

    it('should include status for each forward', async () => {
        const forwards = [
            {
                sshHost: 'server1.com',
                sshPort: 22,
                sshUsername: 'user1',
                localPort: 8080,
                remoteHost: 'localhost',
                remotePort: 3000,
                status: 'active' as const,
            },
            {
                sshHost: 'server2.com',
                sshPort: 22,
                sshUsername: 'user2',
                localPort: 8081,
                remoteHost: 'localhost',
                remotePort: 3001,
                status: 'active' as const,
            },
        ];

        mockSSHManager.listPortForwards.mockReturnValue(forwards);

        const result = await handleListPortForwards({}, context);

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.forwards[0].status).toBe('active');
        expect(response.forwards[1].status).toBe('active');
    });
});
