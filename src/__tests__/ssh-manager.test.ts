import { SSHConnectionManager } from '../ssh-manager.js';
import type { SSHConfig } from '../types.js';
import { Client } from 'ssh2';
import { readFile } from 'fs/promises';

jest.mock('ssh2');
jest.mock('fs/promises');

describe('SSHConnectionManager', () => {
  let sshManager: SSHConnectionManager;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    jest.clearAllMocks();
    sshManager = new SSHConnectionManager(5);

    mockClient = {
      connect: jest.fn(),
      on: jest.fn(),
      exec: jest.fn(),
      forwardOut: jest.fn(),
      end: jest.fn(),
      _sock: { destroyed: false },
    } as any;

    (Client as unknown as jest.Mock).mockImplementation(() => mockClient);
  });

  describe('getConnection', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    it('should create new connection with key auth', async () => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      const client = await sshManager.getConnection(sshConfig);

      expect(Client).toHaveBeenCalled();
      expect(readFile).toHaveBeenCalledWith('/path/to/key', 'utf-8');
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'example.com',
          port: 22,
          username: 'user',
          privateKey: mockKey,
        })
      );
      expect(client).toBe(mockClient);
    });

    it('should create connection with SSH key from file', async () => {
      const keyConfig: SSHConfig = {
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key',
      };

      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      await sshManager.getConnection(keyConfig);

      expect(readFile).toHaveBeenCalledWith('/path/to/key', 'utf-8');
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: mockKey,
        })
      );
    });

    it('should reuse existing connection', async () => {
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      const client1 = await sshManager.getConnection(sshConfig);
      const client2 = await sshManager.getConnection(sshConfig);

      expect(client1).toBe(client2);
      expect(Client).toHaveBeenCalledTimes(1);
    });

    it('should throw error when max connections reached', async () => {
      const smallManager = new SSHConnectionManager(1);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      await smallManager.getConnection(sshConfig);

      const differentConfig: SSHConfig = {
        ...sshConfig,
        host: 'different.com',
      };

      await expect(smallManager.getConnection(differentConfig)).rejects.toThrow(
        'Maximum number of connections'
      );
    });

    it('should throw error on connection failure', async () => {
      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection failed')), 0);
        }
        return mockClient;
      });

      await expect(sshManager.getConnection(sshConfig)).rejects.toThrow('Connection failed');
    });

  });

  describe('executeCommand', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    beforeEach(() => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
    });

    it('should execute command and return output', async () => {
      const mockStream: any = {
        on: jest.fn(),
        stderr: { on: jest.fn() },
      };

      mockClient.exec.mockImplementation((cmd: string, callback: any) => {
        callback(null, mockStream);
        return mockClient;
      });

      mockStream.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('output data')), 0);
        } else if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockStream;
      });

      mockStream.stderr.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('')), 0);
        }
        return mockStream.stderr;
      });

      const result = await sshManager.executeCommand(sshConfig, 'ls -la');

      expect(mockClient.exec).toHaveBeenCalledWith('ls -la', expect.any(Function));
      expect(result).toEqual({
        stdout: 'output data',
        stderr: '',
        exitCode: 0,
      });
    });

    it('should capture stderr output', async () => {
      const mockStream: any = {
        on: jest.fn(),
        stderr: { on: jest.fn() },
      };

      mockClient.exec.mockImplementation((cmd: string, callback: any) => {
        callback(null, mockStream);
        return mockClient;
      });

      mockStream.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('')), 0);
        } else if (event === 'close') {
          setTimeout(() => callback(1), 10);
        }
        return mockStream;
      });

      mockStream.stderr.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('error output')), 0);
        }
        return mockStream.stderr;
      });

      const result = await sshManager.executeCommand(sshConfig, 'invalid-command');

      expect(result).toEqual({
        stdout: '',
        stderr: 'error output',
        exitCode: 1,
      });
    });

    it('should reject on exec error', async () => {
      mockClient.exec.mockImplementation((cmd: string, callback: any) => {
        callback(new Error('Exec failed'), null);
        return mockClient;
      });

      await expect(sshManager.executeCommand(sshConfig, 'ls')).rejects.toThrow('Exec failed');
    });

    it('should reject on stream error', async () => {
      const mockStream: any = {
        on: jest.fn(),
        stderr: { on: jest.fn() },
      };

      mockClient.exec.mockImplementation((cmd: string, callback: any) => {
        callback(null, mockStream);
        return mockClient;
      });

      mockStream.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          callback(new Error('Stream error'));
        }
        return mockStream;
      });

      mockStream.stderr.on.mockReturnValue(mockStream.stderr);

      await expect(sshManager.executeCommand(sshConfig, 'ls')).rejects.toThrow('Stream error');
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      const config1: SSHConfig = {
        host: 'host1.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key1',
      };

      const config2: SSHConfig = {
        host: 'host2.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key2',
      };

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      await sshManager.getConnection(config1);
      await sshManager.getConnection(config2);

      sshManager.disconnectAll();

      expect(mockClient.end).toHaveBeenCalledTimes(2);
    });
  });

  describe('listPortForwards', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    beforeEach(() => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });
    });

    it('should return empty array when no forwards exist', () => {
      const forwards = sshManager.listPortForwards();
      expect(forwards).toEqual([]);
    });

    it('should list all active port forwards', async () => {
      const forwards = sshManager.listPortForwards();
      expect(Array.isArray(forwards)).toBe(true);
    });

    it('should return port forward details with correct structure', () => {
      const forwards = sshManager.listPortForwards();

      expect(Array.isArray(forwards)).toBe(true);

      forwards.forEach(forward => {
        expect(forward).toHaveProperty('sshHost');
        expect(forward).toHaveProperty('sshPort');
        expect(forward).toHaveProperty('sshUsername');
        expect(forward).toHaveProperty('localPort');
        expect(forward).toHaveProperty('remoteHost');
        expect(forward).toHaveProperty('remotePort');
        expect(forward).toHaveProperty('status');
        expect(forward.status).toBe('active');
      });
    });
  });

  describe('setupPortForward', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    let mockServer: any;
    let mockNetModule: any;

    beforeEach(() => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      mockServer = {
        listen: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      };

      mockNetModule = require('net');
      mockNetModule.createServer = jest.fn(() => mockServer);
    });

    it('should successfully set up port forward', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      const result = await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);

      expect(result).toEqual({
        localPort: 8080,
        status: 'active',
      });

      expect(mockNetModule.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(8080, '127.0.0.1', expect.any(Function));
    });

    it('should return already_active for duplicate port forward', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      const result1 = await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);
      expect(result1.status).toBe('active');

      const result2 = await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);
      expect(result2).toEqual({
        localPort: 8080,
        status: 'already_active',
      });

      expect(mockNetModule.createServer).toHaveBeenCalledTimes(1);
    });

    it('should reject on server listen error', async () => {
      const listenError = new Error('Port already in use');

      mockServer.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(listenError), 0);
        }
        return mockServer;
      });

      mockServer.listen.mockReturnValue(mockServer);

      await expect(
        sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000)
      ).rejects.toThrow('Port already in use');
    });

    it('should establish connection before setting up forward', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);

      expect(Client).toHaveBeenCalled();
    });

    it('should handle socket connections with forwardOut', async () => {
      let socketHandler: any;

      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      mockNetModule.createServer.mockImplementation((handler: any) => {
        socketHandler = handler;
        return mockServer;
      });

      await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);

      expect(socketHandler).toBeDefined();

      const mockSocket = {
        setNoDelay: jest.fn(),
        setKeepAlive: jest.fn(),
        pipe: jest.fn(),
        on: jest.fn(),
        destroy: jest.fn(),
        end: jest.fn(),
      };

      const mockStream = {
        pipe: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      mockClient.forwardOut.mockImplementation((srcHost, srcPort, dstHost, dstPort, callback) => {
        if (callback) {
          callback(undefined, mockStream as any);
        }
        return mockClient;
      });

      socketHandler(mockSocket);

      expect(mockSocket.setNoDelay).toHaveBeenCalledWith(true);
      expect(mockSocket.setKeepAlive).toHaveBeenCalledWith(true, 60000);
      expect(mockClient.forwardOut).toHaveBeenCalledWith(
        '127.0.0.1',
        8080,
        'localhost',
        3000,
        expect.any(Function)
      );
    });
  });

  describe('closePortForward', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    let mockServer: any;
    let mockNetModule: any;

    beforeEach(() => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      mockServer = {
        listen: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      };

      mockNetModule = require('net');
      mockNetModule.createServer = jest.fn(() => mockServer);
    });

    it('should close existing port forward', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);

      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 0);
      });

      await sshManager.closePortForward(sshConfig, 8080, 'localhost', 3000);

      expect(mockServer.close).toHaveBeenCalled();

      const forwards = sshManager.listPortForwards();
      expect(forwards).toHaveLength(0);
    });

    it('should handle closing non-existent port forward gracefully', async () => {
      await expect(
        sshManager.closePortForward(sshConfig, 9999, 'localhost', 3000)
      ).resolves.toBeUndefined();
    });

    it('should invoke server close callback', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);

      const closeCallback = jest.fn();
      mockServer.close.mockImplementation((callback: any) => {
        callback();
        closeCallback();
      });

      await sshManager.closePortForward(sshConfig, 8080, 'localhost', 3000);

      expect(closeCallback).toHaveBeenCalled();
    });

    it('should handle multiple forwards and close specific one', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);

      await sshManager.setupPortForward(sshConfig, 8080, 'localhost', 3000);
      await sshManager.setupPortForward(sshConfig, 8081, 'localhost', 3001);

      let forwards = sshManager.listPortForwards();
      expect(forwards).toHaveLength(2);

      mockServer.close.mockImplementation((callback: any) => {
        setTimeout(() => callback(), 0);
      });

      await sshManager.closePortForward(sshConfig, 8080, 'localhost', 3000);

      forwards = sshManager.listPortForwards();
      expect(forwards).toHaveLength(1);
      expect(forwards[0].localPort).toBe(8081);
    });
  });
});
