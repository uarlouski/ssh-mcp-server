import { ConfigManager } from '../config.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

jest.mock('fs/promises');
jest.mock('fs');

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockConfigPath = '/mock/config.json';

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager(mockConfigPath);
  });

  describe('load', () => {
    it('should load valid config file', async () => {
      const mockConfig = {
        allowedHosts: ['example.com'],
        allowedCommands: ['ls', 'pwd'],
        timeout: 5000,
        maxConnections: 3,
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(existsSync).toHaveBeenCalledWith(mockConfigPath);
      expect(readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should handle missing config file gracefully', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      await expect(configManager.load()).rejects.toThrow(
        'Config file not found at /mock/config.json'
      );
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should throw error on invalid JSON', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue('invalid json');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(configManager.load()).rejects.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('isCommandAllowed', () => {
    it('should return true when no restrictions configured', () => {
      expect(configManager.isCommandAllowed('any command')).toBe(true);
    });

    it('should return true for allowed command', async () => {
      const mockConfig = {
        allowedCommands: ['ls', 'pwd', 'cat'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('ls -la')).toBe(true);
      expect(configManager.isCommandAllowed('pwd')).toBe(true);
      expect(configManager.isCommandAllowed('cat file.txt')).toBe(true);
    });

    it('should return false for disallowed command', async () => {
      const mockConfig = {
        allowedCommands: ['ls', 'pwd'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('rm -rf /')).toBe(false);
      expect(configManager.isCommandAllowed('chmod 777 file')).toBe(false);
    });

    it('should extract base command correctly', async () => {
      const mockConfig = {
        allowedCommands: ['docker'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('docker ps')).toBe(true);
      expect(configManager.isCommandAllowed('  docker  run  nginx  ')).toBe(true);
    });

    it('should block command injection via pipes when allowedCommands is specified', async () => {
      const mockConfig = {
        allowedCommands: ['ls'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('ls -la')).toBe(true);
      expect(configManager.isCommandAllowed('ls | rm -rf /')).toBe(false);
      expect(configManager.isCommandAllowed('ls && malicious')).toBe(false);
      expect(configManager.isCommandAllowed('ls || dangerous')).toBe(false);
      expect(configManager.isCommandAllowed('ls; bad-command')).toBe(false);
    });

    it('should allow piped commands when all are in allowedCommands', async () => {
      const mockConfig = {
        allowedCommands: ['ls', 'grep', 'wc'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('ls | grep test')).toBe(true);
      expect(configManager.isCommandAllowed('ls | grep test | wc -l')).toBe(true);
      expect(configManager.isCommandAllowed('ls && grep pattern file.txt')).toBe(true);
    });

    it('should allow all commands when allowedCommands is empty', async () => {
      const mockConfig = {
        allowedCommands: [],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('ls -la')).toBe(true);
      expect(configManager.isCommandAllowed('rm -rf /')).toBe(true);
      expect(configManager.isCommandAllowed('ls | rm -rf /')).toBe(true);
      expect(configManager.isCommandAllowed('any dangerous command')).toBe(true);
    });

    it('should apply strict validation when allowedCommands is specified', async () => {
      const mockConfig = {
        allowedCommands: ['ls'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('ls -la')).toBe(true);
      expect(configManager.isCommandAllowed('ls | rm -rf /')).toBe(false);
    });

    it('should handle command substitution when allowedCommands is specified', async () => {
      const mockConfig = {
        allowedCommands: ['echo', 'whoami'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.isCommandAllowed('echo $(whoami)')).toBe(true);
      expect(configManager.isCommandAllowed('echo $(rm -rf /)')).toBe(false);
    });
  });



  describe('getServer', () => {
    it('should return server config when connectionName is valid', async () => {
      const mockConfig = {
        servers: {
          prod: {
            host: 'prod.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      const server = configManager.getServer('prod');
      expect(server).toEqual(mockConfig.servers.prod);
    });

    it('should throw error when connectionName is undefined', () => {
      expect(() => configManager.getServer(undefined)).toThrow(
        'connectionName is required and must reference a server configured in config.json'
      );
    });

    it('should throw error when server not found', async () => {
      const mockConfig = {
        servers: {},
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(() => configManager.getServer('nonexistent')).toThrow(
        "Server configuration 'nonexistent' not found in config.json"
      );
    });
  });

  describe('getTimeout', () => {
    it('should return configured timeout', async () => {
      const mockConfig = {
        timeout: 15000,
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.getTimeout()).toBe(15000);
    });

    it('should return default timeout when not configured', () => {
      expect(configManager.getTimeout()).toBe(30000);
    });
  });

  describe('getMaxConnections', () => {
    it('should return configured maxConnections', async () => {
      const mockConfig = {
        maxConnections: 10,
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(configManager.getMaxConnections()).toBe(10);
    });

    it('should return default maxConnections when not configured', () => {
      expect(configManager.getMaxConnections()).toBe(5);
    });
  });

  describe('Server Configuration Validation', () => {
    it('should accept valid server config with privateKeyPath', async () => {
      const mockConfig = {
        servers: {
          valid: {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/home/user/.ssh/id_rsa',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should reject server config with missing host', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "Invalid configuration for server 'invalid'"
      );
      await expect(configManager.load()).rejects.toThrow(
        'host is required and must be a non-empty string'
      );
    });

    it('should reject server config with empty host', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: '   ',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'host is required and must be a non-empty string'
      );
    });

    it('should default port to 22 when missing', async () => {
      const mockConfig = {
        servers: {
          valid: {
            host: 'example.com',
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();
      const server = configManager.getServer('valid');
      expect(server.port).toBe(22);
    });

    it('should reject server config with invalid port (too low)', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 0,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'port must be a number between 1 and 65535'
      );
    });

    it('should reject server config with invalid port (too high)', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 70000,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'port must be a number between 1 and 65535'
      );
    });

    it('should reject server config with missing username', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 22,
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'username is required and must be a non-empty string'
      );
    });

    it('should reject server config with empty username', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 22,
            username: '',
            privateKeyPath: '/path/to/key',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'username is required and must be a non-empty string'
      );
    });

    it('should reject server config with missing privateKeyPath', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 22,
            username: 'user',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'privateKeyPath is required and must be a non-empty string'
      );
    });

    it('should reject server config with invalid privateKeyPath type', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: 12345,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow('privateKeyPath is required and must be a non-empty string');
    });

    it('should reject server config with empty privateKeyPath', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '  ',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow('privateKeyPath is required and must be a non-empty string');
    });

    it('should show multiple validation errors together', async () => {
      const mockConfig = {
        servers: {
          invalid: {
            host: '',
            port: 99999,
            username: '',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      const loadPromise = configManager.load();
      await expect(loadPromise).rejects.toThrow('host is required');
      await expect(loadPromise).rejects.toThrow('port must be a number between 1 and 65535');
      await expect(loadPromise).rejects.toThrow('username is required');
      await expect(loadPromise).rejects.toThrow(
        'privateKeyPath is required and must be a non-empty string'
      );
    });

    it('should validate all servers in config', async () => {
      const mockConfig = {
        servers: {
          valid: {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
          invalid: {
            host: 'bad.com',
            port: 22,
            username: 'user',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "Invalid configuration for server 'invalid'"
      );
    });

    it('should allow config with no servers', async () => {
      const mockConfig = {
        allowedCommands: ['ls', 'pwd'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should allow empty servers object', async () => {
      const mockConfig = {
        servers: {},
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });
  });

  describe('Port Forwarding Services Validation', () => {
    it('should accept valid port forwarding service config', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'test-service': {
            connectionName: 'test-server',
            localPort: 8080,
            remoteHost: 'localhost',
            remotePort: 3000,
            description: 'Test service',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should accept service without localPort (dynamic allocation)', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'dynamic-service': {
            connectionName: 'test-server',
            remoteHost: 'localhost',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should reject service with missing connectionName', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            remoteHost: 'localhost',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "Invalid port forwarding service 'invalid-service'"
      );
      await expect(configManager.load()).rejects.toThrow(
        'connectionName is required and must reference a server in config.json'
      );
    });

    it('should reject service with non-existent connectionName', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            connectionName: 'non-existent-server',
            remoteHost: 'localhost',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "connectionName 'non-existent-server' does not exist in servers"
      );
    });

    it('should reject service with missing remoteHost', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            connectionName: 'test-server',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'remoteHost is required and must be a non-empty string'
      );
    });

    it('should reject service with missing remotePort', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            connectionName: 'test-server',
            remoteHost: 'localhost',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'remotePort must be a number between 1 and 65535'
      );
    });

    it('should reject service with invalid remotePort', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            connectionName: 'test-server',
            remoteHost: 'localhost',
            remotePort: 99999,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'remotePort must be a number between 1 and 65535'
      );
    });

    it('should reject service with invalid localPort (negative)', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'invalid-service': {
            connectionName: 'test-server',
            localPort: -1,
            remoteHost: 'localhost',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'localPort must be a number between 0 and 65535'
      );
    });

    it('should accept service with localPort of 0 (dynamic allocation)', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'dynamic-service': {
            connectionName: 'test-server',
            localPort: 0,
            remoteHost: 'localhost',
            remotePort: 3000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });
  });

  describe('getPortForwardingService', () => {
    it('should return service config when serviceName is valid', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'my-service': {
            connectionName: 'test-server',
            localPort: 8080,
            remoteHost: 'localhost',
            remotePort: 3000,
            description: 'Test service',
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      const service = configManager.getPortForwardingService('my-service');
      expect(service).toEqual(mockConfig.portForwardingServices['my-service']);
    });

    it('should throw error when serviceName is empty', async () => {
      await expect(() => configManager.getPortForwardingService('')).toThrow(
        'serviceName is required'
      );
    });

    it('should throw error when service not found', async () => {
      const mockConfig = {
        portForwardingServices: {},
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      expect(() => configManager.getPortForwardingService('nonexistent')).toThrow(
        "Port forwarding service 'nonexistent' not found in config.json"
      );
    });
  });

  describe('listPortForwardingServices', () => {
    it('should return list of service names', async () => {
      const mockConfig = {
        servers: {
          'test-server': {
            host: 'example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
          },
        },
        portForwardingServices: {
          'service1': {
            connectionName: 'test-server',
            remoteHost: 'localhost',
            remotePort: 3000,
          },
          'service2': {
            connectionName: 'test-server',
            remoteHost: 'localhost',
            remotePort: 4000,
          },
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      const services = configManager.listPortForwardingServices();
      expect(services).toEqual(['service1', 'service2']);
    });

    it('should return empty array when no services configured', async () => {
      const mockConfig = {};

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await configManager.load();

      const services = configManager.listPortForwardingServices();
      expect(services).toEqual([]);
    });
  });

  describe('Command Templates Validation', () => {
    it('should accept valid command template in string format', async () => {
      const mockConfig = {
        commandTemplates: {
          'test-template': 'kubectl logs {{pod}} --tail={{lines:100}}'
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should accept valid command template in object format', async () => {
      const mockConfig = {
        commandTemplates: {
          'test-template': {
            command: 'kubectl logs {{pod}} --tail={{lines:100}}',
            description: 'Get pod logs'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should reject template with empty command (string format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': ''
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "Invalid command template 'invalid-template'"
      );
      await expect(configManager.load()).rejects.toThrow(
        'Template command is required and must be a non-empty string'
      );
    });

    it('should reject template with whitespace-only command (string format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': '   '
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template command is required and must be a non-empty string'
      );
    });

    it('should reject template with missing command (object format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': {
            description: 'Missing command'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template command is required and must be a non-empty string'
      );
    });

    it('should reject template with empty command (object format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': {
            command: '',
            description: 'Empty command'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template command is required and must be a non-empty string'
      );
    });

    it('should reject template with whitespace-only command (object format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': {
            command: '   ',
            description: 'Whitespace command'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template command is required and must be a non-empty string'
      );
    });

    it('should reject template with empty description', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': {
            command: 'valid command',
            description: '   '
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template description, if provided, must be a non-empty string'
      );
    });

    it('should accept template with valid description', async () => {
      const mockConfig = {
        commandTemplates: {
          'valid-template': {
            command: 'kubectl get pods',
            description: 'List all pods'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should accept template without description (object format)', async () => {
      const mockConfig = {
        commandTemplates: {
          'valid-template': {
            command: 'kubectl get pods'
          }
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should reject template with invalid type', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': 12345
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template must be either a string or an object with a command property'
      );
    });

    it('should reject template with null value', async () => {
      const mockConfig = {
        commandTemplates: {
          'invalid-template': null
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        'Template must be either a string or an object with a command property'
      );
    });

    it('should validate all templates in config', async () => {
      const mockConfig = {
        commandTemplates: {
          'valid-template': 'valid command',
          'invalid-template': ''
        },
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).rejects.toThrow(
        "Invalid command template 'invalid-template'"
      );
    });

    it('should allow config with no templates', async () => {
      const mockConfig = {
        allowedCommands: ['ls', 'pwd'],
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });

    it('should allow empty commandTemplates object', async () => {
      const mockConfig = {
        commandTemplates: {},
      };

      (existsSync as jest.Mock).mockReturnValue(true);
      (readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(configManager.load()).resolves.not.toThrow();
    });
  });
});
