import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { SSHConfigParser } from '../ssh-config-parser.js';
import type { SSHConfigImport, SSHConfig } from '../types.js';

describe('SSHConfigParser', () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    testDir = join(tmpdir(), `ssh-config-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, 'config');
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('parseSSHConfig', () => {
    it('should parse a basic SSH config', async () => {
      const configContent = `
Host example
    HostName example.com
    User testuser
    Port 2222
    IdentityFile ~/.ssh/id_rsa
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers).toHaveProperty('example');
      expect(servers.example).toEqual({
        host: 'example.com',
        port: 2222,
        username: 'testuser',
        privateKeyPath: expect.stringContaining('id_rsa'),
      });
    });

    it('should parse multiple hosts', async () => {
      const configContent = `
Host server1
    HostName server1.com
    User user1
    IdentityFile ~/.ssh/key1

Host server2
    HostName server2.com
    User user2
    IdentityFile ~/.ssh/key2
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(Object.keys(servers)).toHaveLength(2);
      expect(servers).toHaveProperty('server1');
      expect(servers).toHaveProperty('server2');
    });

    it('should apply wildcard config to specific hosts', async () => {
      const configContent = `
Host prod-server
    HostName prod.example.com
    User produser
    IdentityFile ~/.ssh/prod_key

Host *
    Port 22
    User defaultuser
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers['prod-server']).toEqual({
        host: 'prod.example.com',
        port: 22,
        username: 'produser',
        privateKeyPath: expect.stringContaining('prod_key'),
      });
    });

    it('should default port to 22 if not specified', async () => {
      const configContent = `
Host example
    HostName example.com
    User testuser
    IdentityFile ~/.ssh/id_rsa
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers.example.port).toBe(22);
    });

    it('should skip hosts without required fields', async () => {
      const configContent = `
Host incomplete1
    HostName example.com
    # Missing User and IdentityFile

Host complete
    HostName example.com
    User testuser
    IdentityFile ~/.ssh/id_rsa

Host incomplete2
    User testuser
    # Missing HostName and IdentityFile
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(Object.keys(servers)).toHaveLength(1);
      expect(servers).toHaveProperty('complete');
    });

    it('should filter hosts by pattern', async () => {
      const configContent = `
Host prod-server-01
    HostName prod01.example.com
    User produser
    IdentityFile ~/.ssh/prod_key

Host prod-server-02
    HostName prod02.example.com
    User produser
    IdentityFile ~/.ssh/prod_key

Host dev-server
    HostName dev.example.com
    User devuser
    IdentityFile ~/.ssh/dev_key
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['prod-*'],
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(Object.keys(servers)).toHaveLength(2);
      expect(servers).toHaveProperty('prod-server-01');
      expect(servers).toHaveProperty('prod-server-02');
      expect(servers).not.toHaveProperty('dev-server');
    });

    it('should handle multiple identity files', async () => {
      const configContent = `
Host example
    HostName example.com
    User testuser
    IdentityFile ~/.ssh/id_rsa
    IdentityFile ~/.ssh/id_ed25519
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      // Should use the first identity file
      expect(servers.example.privateKeyPath).toContain('id_rsa');
    });

    it('should return empty object for non-existent config file', async () => {
      const importConfig: SSHConfigImport = {
        path: '/non/existent/path',
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers).toEqual({});
    });

    it('should return empty object when hosts is empty array', async () => {
      const configContent = `
Host test-server
    HostName test.example.com
    User testuser
    IdentityFile ~/.ssh/test_key
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: [],
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SSH-MCP] sshConfigImport.hosts is empty array, no servers will be imported'
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should skip wildcard-only hosts', async () => {
      const configContent = `
Host *
    User defaultuser
    IdentityFile ~/.ssh/id_rsa

Host specific
    HostName specific.com
    User specificuser
    IdentityFile ~/.ssh/specific_key
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers).not.toHaveProperty('*');
      expect(servers).toHaveProperty('specific');
    });

    it('should use Host value as hostname if HostName is not specified', async () => {
      const configContent = `
Host example.com
    User testuser
    IdentityFile ~/.ssh/id_rsa
`;
      await writeFile(testConfigPath, configContent);

      const importConfig: SSHConfigImport = {
        path: testConfigPath,
        hosts: ['*'], // Import all hosts
      };

      const servers = await SSHConfigParser.parseSSHConfig(importConfig);

      expect(servers['example.com'].host).toBe('example.com');
    });
  });

});

