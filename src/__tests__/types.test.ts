import type { SSHConfig, CommandResult, Config, PortForwardInfo } from '../types.js';

describe('Type Definitions', () => {
  describe('SSHConfig', () => {
    it('should accept valid key configuration with privateKeyPath', () => {
      const config: SSHConfig = {
        host: 'example.com',
        port: 22,
        username: 'user',
        privateKeyPath: '/path/to/key',
      };

      expect(config.privateKeyPath).toBeDefined();
    });
  });

  describe('CommandResult', () => {
    it('should represent successful command execution', () => {
      const result: CommandResult = {
        stdout: 'command output',
        stderr: '',
        exitCode: 0,
      };

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('should represent failed command execution', () => {
      const result: CommandResult = {
        stdout: '',
        stderr: 'error message',
        exitCode: 1,
      };

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    it('should allow null exit code', () => {
      const result: CommandResult = {
        stdout: '',
        stderr: '',
        exitCode: null,
      };

      expect(result.exitCode).toBeNull();
    });
  });

  describe('Config', () => {
    it('should accept minimal configuration', () => {
      const config: Config = {};

      expect(config).toBeDefined();
    });

    it('should accept full configuration', () => {
      const config: Config = {
        allowedCommands: ['ls', 'pwd'],
        servers: {
          prod: {
            host: 'prod.example.com',
            port: 22,
            username: 'admin',
            privateKeyPath: '/path/to/key',
          },
        },
        timeout: 15000,
        maxConnections: 10,
      };

      expect(config.allowedCommands).toHaveLength(2);
      expect(config.servers?.prod).toBeDefined();
    });
  });

  describe('PortForwardInfo', () => {
    it('should represent active port forwarding information', () => {
      const info: PortForwardInfo = {
        sshHost: 'bastion.example.com',
        sshPort: 22,
        sshUsername: 'admin',
        localPort: 8080,
        remoteHost: 'internal.example.com',
        remotePort: 5432,
        status: 'active',
      };

      expect(info.sshHost).toBe('bastion.example.com');
      expect(info.sshPort).toBe(22);
      expect(info.sshUsername).toBe('admin');
      expect(info.localPort).toBe(8080);
      expect(info.remoteHost).toBe('internal.example.com');
      expect(info.remotePort).toBe(5432);
      expect(info.status).toBe('active');
    });
  });
});
