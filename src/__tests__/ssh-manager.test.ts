import { SSHConnectionManager } from '../ssh-manager.js';
import type { SSHConfig } from '../types.js';
import { Client } from 'ssh2';
import { readFile, stat } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';

jest.mock('ssh2');
jest.mock('fs/promises');
jest.mock('fs');

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

  afterEach(() => {
    jest.useRealTimers();
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

    it('should timeout and close the stream when execution exceeds timeout', async () => {
      jest.useFakeTimers();

      const mockStream: any = {
        on: jest.fn(),
        close: jest.fn(),
        stderr: { on: jest.fn() },
      };

      mockClient.exec.mockImplementation((cmd: string, callback: any) => {
        callback(null, mockStream);
        return mockClient;
      });

      // Never emit 'close' to simulate a hung command
      mockStream.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('partial')), 0);
        }
        return mockStream;
      });
      mockStream.stderr.on.mockReturnValue(mockStream.stderr);

      const promise = sshManager.executeCommand(sshConfig, 'sleep 999', 50);

      // Let initial stdout be captured and trigger timeout
      await jest.runAllTimersAsync();

      const result = await promise;
      expect(mockStream.close).toHaveBeenCalled();
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBeNull();
      expect(result.stdout).toContain('partial');
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
        address: jest.fn(),
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

    it('should handle dynamic port allocation', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);
      mockServer.address.mockReturnValue({ port: 12345 });

      const result = await sshManager.setupPortForward(sshConfig, 0, 'localhost', 3000);

      expect(result).toEqual({
        localPort: 12345,
        status: 'active',
      });

      expect(mockNetModule.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(0, '127.0.0.1', expect.any(Function));

      const forwards = sshManager.listPortForwards();
      expect(forwards).toHaveLength(1);
      expect(forwards[0].localPort).toBe(12345);
    });

    it('should use allocated port in forwardOut when using dynamic allocation', async () => {
      let socketHandler: any;

      mockNetModule.createServer.mockImplementation((handler: any) => {
        socketHandler = handler;
        return mockServer;
      });

      mockServer.listen.mockImplementation((port: number, host: string, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockServer;
      });

      mockServer.on.mockReturnValue(mockServer);
      mockServer.address.mockReturnValue({ port: 12345 });

      await sshManager.setupPortForward(sshConfig, 0, 'localhost', 3000);

      const mockSocket = {
        localPort: 12345,
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

      expect(mockClient.forwardOut).toHaveBeenCalledWith(
        '127.0.0.1',
        12345,
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
        address: jest.fn().mockReturnValue({ port: 8080 }),
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

  describe('SFTP Operations', () => {
    const sshConfig: SSHConfig = {
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKeyPath: '/path/to/key',
    };

    let mockSFTP: any;

    beforeEach(() => {
      const mockKey = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      (readFile as jest.Mock).mockResolvedValue(mockKey);

      mockSFTP = {
        createReadStream: jest.fn(),
        createWriteStream: jest.fn(),
        readdir: jest.fn(),
        unlink: jest.fn(),
        chmod: jest.fn(),
        end: jest.fn(),
      };

      mockClient.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      (mockClient as any).sftp = jest.fn((callback: any) => {
        setTimeout(() => callback(null, mockSFTP), 0);
      });
    });

    describe('uploadFile', () => {
      it('should upload a file successfully', async () => {
        const mockStats = { isFile: () => true, size: 100 };
        (stat as jest.Mock).mockResolvedValue(mockStats);

        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        (createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        mockSFTP.createWriteStream.mockReturnValue(mockWriteStream);

        mockReadStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('test data')), 0);
          }
          return mockReadStream;
        });

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => callback(), 10);
          }
          return mockWriteStream;
        });

        const result = await sshManager.uploadFile(
          sshConfig,
          '/local/test.txt',
          '/remote/test.txt'
        );

        expect(result.success).toBe(true);
        expect(result.bytesTransferred).toBeGreaterThan(0);
        expect(result.message).toContain('Successfully uploaded');
        expect(createReadStream).toHaveBeenCalledWith('/local/test.txt');
        expect(mockSFTP.createWriteStream).toHaveBeenCalledWith('/remote/test.txt');
        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should upload file with custom permissions', async () => {
        const mockStats = { isFile: () => true, size: 100 };
        (stat as jest.Mock).mockResolvedValue(mockStats);

        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn().mockReturnThis(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        (createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        mockSFTP.createWriteStream.mockReturnValue(mockWriteStream);

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(async () => await callback(), 10);
          }
          return mockWriteStream;
        });

        mockSFTP.chmod.mockImplementation((path: string, mode: number, callback: any) => {
          setTimeout(() => callback(null), 0);
        });

        const result = await sshManager.uploadFile(
          sshConfig,
          '/local/test.txt',
          '/remote/test.txt',
          '0755'
        );

        expect(result.success).toBe(true);
        expect(mockSFTP.chmod).toHaveBeenCalledWith('/remote/test.txt', 0o755, expect.any(Function));
      });

      it('should fail when local file does not exist', async () => {
        (stat as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file'));

        const result = await sshManager.uploadFile(
          sshConfig,
          '/local/nonexistent.txt',
          '/remote/test.txt'
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('Upload failed');
      });

      it('should fail when local path is not a file', async () => {
        const mockStats = { isFile: () => false };
        (stat as jest.Mock).mockResolvedValue(mockStats);

        const result = await sshManager.uploadFile(
          sshConfig,
          '/local/directory',
          '/remote/test.txt'
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('is not a file');
      });

      it('should handle write stream errors', async () => {
        const mockStats = { isFile: () => true, size: 100 };
        (stat as jest.Mock).mockResolvedValue(mockStats);

        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn().mockReturnThis(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        (createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        mockSFTP.createWriteStream.mockReturnValue(mockWriteStream);

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Write error')), 0);
          }
          return mockWriteStream;
        });

        await expect(
          sshManager.uploadFile(sshConfig, '/local/test.txt', '/remote/test.txt')
        ).rejects.toThrow('Write error');

        expect(mockSFTP.end).toHaveBeenCalled();
      });
    });

    describe('downloadFile', () => {
      it('should download a file successfully', async () => {
        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        mockSFTP.createReadStream.mockReturnValue(mockReadStream);
        (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        mockReadStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('downloaded data')), 0);
          }
          return mockReadStream;
        });

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => callback(), 10);
          }
          return mockWriteStream;
        });

        const result = await sshManager.downloadFile(
          sshConfig,
          '/remote/test.txt',
          '/local/test.txt'
        );

        expect(result.success).toBe(true);
        expect(result.bytesTransferred).toBeGreaterThan(0);
        expect(result.message).toContain('Successfully downloaded');
        expect(mockSFTP.createReadStream).toHaveBeenCalledWith('/remote/test.txt');
        expect(createWriteStream).toHaveBeenCalledWith('/local/test.txt');
        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should handle read stream errors', async () => {
        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn(),
        };

        const mockWriteStream: any = {
          on: jest.fn().mockReturnThis(),
        };

        mockSFTP.createReadStream.mockReturnValue(mockReadStream);
        (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        mockReadStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Read error')), 0);
          }
          return mockReadStream;
        });

        await expect(
          sshManager.downloadFile(sshConfig, '/remote/test.txt', '/local/test.txt')
        ).rejects.toThrow('Read error');

        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should handle write stream errors during download', async () => {
        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn().mockReturnThis(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        mockSFTP.createReadStream.mockReturnValue(mockReadStream);
        (createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Write error')), 0);
          }
          return mockWriteStream;
        });

        await expect(
          sshManager.downloadFile(sshConfig, '/remote/test.txt', '/local/test.txt')
        ).rejects.toThrow('Write error');
      });
    });

    describe('listRemoteFiles', () => {
      it('should list files in remote directory', async () => {
        const mockFiles = [
          {
            filename: 'file1.txt',
            longname: '-rw-r--r-- 1 user group 100 Jan 1 file1.txt',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 100,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
          {
            filename: 'file2.log',
            longname: '-rw-r--r-- 1 user group 200 Jan 1 file2.log',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 200,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
        ];

        mockSFTP.readdir.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(null, mockFiles), 0);
        });

        const result = await sshManager.listRemoteFiles(sshConfig, '/remote/dir');

        expect(result.files).toHaveLength(2);
        expect(result.totalCount).toBe(2);
        expect(result.files[0].filename).toBe('file1.txt');
        expect(result.files[1].filename).toBe('file2.log');
        expect(mockSFTP.readdir).toHaveBeenCalledWith('/remote/dir', expect.any(Function));
        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should filter files by pattern', async () => {
        const mockFiles = [
          {
            filename: 'file1.txt',
            longname: '-rw-r--r-- 1 user group 100 Jan 1 file1.txt',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 100,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
          {
            filename: 'file2.log',
            longname: '-rw-r--r-- 1 user group 200 Jan 1 file2.log',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 200,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
          {
            filename: 'file3.txt',
            longname: '-rw-r--r-- 1 user group 150 Jan 1 file3.txt',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 150,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
        ];

        mockSFTP.readdir.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(null, mockFiles), 0);
        });

        const result = await sshManager.listRemoteFiles(sshConfig, '/remote/dir', '.*\\.txt$');

        expect(result.files).toHaveLength(2);
        expect(result.totalCount).toBe(2);
        expect(result.files.every(f => f.filename.endsWith('.txt'))).toBe(true);
      });

      it('should handle readdir errors', async () => {
        mockSFTP.readdir.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(new Error('Directory not found')), 0);
        });

        await expect(
          sshManager.listRemoteFiles(sshConfig, '/remote/nonexistent')
        ).rejects.toThrow('Failed to list files');

        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should return file attributes correctly', async () => {
        const mockFiles = [
          {
            filename: 'test.txt',
            longname: '-rw-r--r-- 1 user group 100 Jan 1 test.txt',
            attrs: {
              mode: 33188,
              uid: 1000,
              gid: 1000,
              size: 100,
              atime: 1609459200,
              mtime: 1609459200,
            },
          },
        ];

        mockSFTP.readdir.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(null, mockFiles), 0);
        });

        const result = await sshManager.listRemoteFiles(sshConfig, '/remote/dir');

        expect(result.files[0]).toHaveProperty('filename', 'test.txt');
        expect(result.files[0]).toHaveProperty('attrs');
        expect(result.files[0].attrs).toHaveProperty('size', 100);
        expect(result.files[0].attrs).toHaveProperty('mode', 33188);
      });
    });

    describe('deleteRemoteFile', () => {
      it('should delete a file successfully', async () => {
        mockSFTP.unlink.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(null), 0);
        });

        const result = await sshManager.deleteRemoteFile(sshConfig, '/remote/test.txt');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Successfully deleted');
        expect(mockSFTP.unlink).toHaveBeenCalledWith('/remote/test.txt', expect.any(Function));
        expect(mockSFTP.end).toHaveBeenCalled();
      });

      it('should handle unlink errors', async () => {
        mockSFTP.unlink.mockImplementation((path: string, callback: any) => {
          setTimeout(() => callback(new Error('File not found')), 0);
        });

        const result = await sshManager.deleteRemoteFile(sshConfig, '/remote/nonexistent.txt');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Delete failed');
        expect(mockSFTP.end).toHaveBeenCalled();
      });
    });

    describe('SFTP connection', () => {
      it('should handle SFTP connection errors', async () => {
        (mockClient as any).sftp = jest.fn((callback: any) => {
          setTimeout(() => callback(new Error('SFTP subsystem not available')), 0);
        });

        const result = await sshManager.uploadFile(sshConfig, '/local/test.txt', '/remote/test.txt');

        expect(result.success).toBe(false);
        expect(result.message).toContain('SFTP subsystem not available');
      });

      it('should reuse SSH connection for multiple SFTP operations', async () => {
        const mockStats = { isFile: () => true, size: 100 };
        (stat as jest.Mock).mockResolvedValue(mockStats);

        const mockReadStream: any = {
          pipe: jest.fn(),
          on: jest.fn().mockReturnThis(),
        };

        const mockWriteStream: any = {
          on: jest.fn(),
        };

        (createReadStream as jest.Mock).mockReturnValue(mockReadStream);
        mockSFTP.createWriteStream.mockReturnValue(mockWriteStream);

        mockWriteStream.on.mockImplementation((event: string, callback: any) => {
          if (event === 'close') {
            setTimeout(() => callback(), 10);
          }
          return mockWriteStream;
        });

        await sshManager.uploadFile(sshConfig, '/local/test1.txt', '/remote/test1.txt');

        await sshManager.uploadFile(sshConfig, '/local/test2.txt', '/remote/test2.txt');

        expect(Client).toHaveBeenCalledTimes(1);
        expect(mockClient.sftp).toHaveBeenCalledTimes(2);
      });
    });
  });
});
