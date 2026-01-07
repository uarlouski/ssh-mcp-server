import { listServers } from '../../tools/core/list-servers.js';
import type { HandlerContext } from '../../tools/types.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

function getTextContent(result: CallToolResult): string {
  const content = result.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  throw new Error('Expected text content');
}

describe('handleListServers', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockSSHManager: jest.Mocked<SSHConnectionManager>;
  let context: HandlerContext;

  beforeEach(() => {
    mockConfigManager = new ConfigManager('test') as jest.Mocked<ConfigManager>;
    mockSSHManager = new SSHConnectionManager({} as any) as jest.Mocked<SSHConnectionManager>;

    context = {
      configManager: mockConfigManager,
      sshManager: mockSSHManager,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return empty list when no servers configured', async () => {
      mockConfigManager.listServers.mockReturnValue([]);

      const result = await listServers.handler({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
      expect(response.servers).toEqual([]);
      expect(response.count).toBe(0);
    });

    it('should return list of servers with connection details', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'production-api',
          host: 'api-prod-01.example.com',
          port: 22,
          username: 'deploy',
        },
        {
          name: 'staging-db',
          host: 'db-staging.example.com',
          port: 2222,
          username: 'admin',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.count).toBe(2);
      expect(response.servers).toHaveLength(2);

      expect(response.servers[0]).toEqual({
        name: 'production-api',
        host: 'api-prod-01.example.com',
        port: 22,
        username: 'deploy',
      });

      expect(response.servers[1]).toEqual({
        name: 'staging-db',
        host: 'db-staging.example.com',
        port: 2222,
        username: 'admin',
      });
    });

    it('should handle servers with custom ports', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'custom-port-server',
          host: 'server.example.com',
          port: 2222,
          username: 'user',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].port).toBe(2222);
    });

    it('should handle servers with default port 22', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'default-port-server',
          host: 'server.example.com',
          port: 22,
          username: 'user',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].port).toBe(22);
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted JSON response', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'test-server',
          host: 'test.example.com',
          port: 22,
          username: 'test',
        },
      ]);

      const result = await listServers.handler({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(getTextContent(result));
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('servers');
      expect(response).toHaveProperty('count');
    });

    it('should format JSON with proper indentation', async () => {
      mockConfigManager.listServers.mockReturnValue([]);

      const result = await listServers.handler({}, context);

      // Check that JSON is pretty-printed (contains newlines and spaces)
      expect(getTextContent(result)).toContain('\n');
      expect(getTextContent(result)).toContain('  '); // 2-space indent
    });

    it('should include all server metadata', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'full-server',
          host: 'server.example.com',
          port: 2222,
          username: 'admin',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      const server = response.servers[0];
      expect(server).toHaveProperty('name');
      expect(server).toHaveProperty('host');
      expect(server).toHaveProperty('port');
      expect(server).toHaveProperty('username');
    });
  });

  describe('Multiple Servers', () => {
    it('should handle multiple servers correctly', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'server1',
          host: 'server1.example.com',
          port: 22,
          username: 'user1',
        },
        {
          name: 'server2',
          host: 'server2.example.com',
          port: 2222,
          username: 'user2',
        },
        {
          name: 'server3',
          host: 'server3.example.com',
          port: 22,
          username: 'user3',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.count).toBe(3);
      expect(response.servers).toHaveLength(3);
      expect(response.servers[0].name).toBe('server1');
      expect(response.servers[1].name).toBe('server2');
      expect(response.servers[2].name).toBe('server3');
    });

    it('should correctly count servers', async () => {
      const servers = Array.from({ length: 5 }, (_, i) => ({
        name: `server${i}`,
        host: `server${i}.example.com`,
        port: 22,
        username: `user${i}`,
      }));

      mockConfigManager.listServers.mockReturnValue(servers);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.count).toBe(5);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle production, staging, and development environments', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'production-api',
          host: 'api-prod-01.example.com',
          port: 22,
          username: 'deploy',
        },
        {
          name: 'staging-api',
          host: 'api-staging.example.com',
          port: 22,
          username: 'deploy',
        },
        {
          name: 'development',
          host: 'dev.example.com',
          port: 2222,
          username: 'dev',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.count).toBe(3);
      expect(response.servers.find((s: any) => s.name === 'production-api')).toBeTruthy();
      expect(response.servers.find((s: any) => s.name === 'staging-api')).toBeTruthy();
      expect(response.servers.find((s: any) => s.name === 'development')).toBeTruthy();
    });

    it('should handle servers with IP addresses', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'internal-db',
          host: '10.0.0.5',
          port: 22,
          username: 'admin',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].host).toBe('10.0.0.5');
    });

    it('should handle servers with different usernames', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'root-server',
          host: 'server1.example.com',
          port: 22,
          username: 'root',
        },
        {
          name: 'deploy-server',
          host: 'server2.example.com',
          port: 22,
          username: 'deploy',
        },
        {
          name: 'admin-server',
          host: 'server3.example.com',
          port: 22,
          username: 'admin',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].username).toBe('root');
      expect(response.servers[1].username).toBe('deploy');
      expect(response.servers[2].username).toBe('admin');
    });
  });

  describe('Edge Cases', () => {
    it('should handle server names with special characters', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'prod-api-01',
          host: 'api.example.com',
          port: 22,
          username: 'deploy',
        },
        {
          name: 'staging_db_primary',
          host: 'db.example.com',
          port: 22,
          username: 'admin',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].name).toBe('prod-api-01');
      expect(response.servers[1].name).toBe('staging_db_primary');
    });

    it('should handle hostnames with subdomains', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'subdomain-server',
          host: 'app.prod.example.com',
          port: 22,
          username: 'user',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].host).toBe('app.prod.example.com');
    });

    it('should handle high port numbers', async () => {
      mockConfigManager.listServers.mockReturnValue([
        {
          name: 'high-port',
          host: 'server.example.com',
          port: 65535,
          username: 'user',
        },
      ]);

      const result = await listServers.handler({}, context);
      const response = JSON.parse(getTextContent(result));

      expect(response.servers[0].port).toBe(65535);
    });
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(listServers.definition.name).toBe('ssh_list_servers');
    });

    it('should have a description', () => {
      expect(listServers.definition.description).toBeTruthy();
      expect(listServers.definition.description).toBeDefined();
      if (listServers.definition.description) {
        expect(listServers.definition.description.length).toBeGreaterThan(0);
      }
    });

    it('should have an input schema', () => {
      expect(listServers.definition.inputSchema).toBeDefined();
      expect(listServers.definition.inputSchema.type).toBe('object');
    });

    it('should accept no input parameters', () => {
      expect(listServers.definition.inputSchema.properties).toEqual({});
    });
  });
});

