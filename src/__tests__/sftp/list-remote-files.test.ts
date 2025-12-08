import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { listRemoteFiles } from '../../tools/sftp/list-remote-files.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleListRemoteFiles', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            listRemoteFiles: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully list files in a directory', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const listResult = {
            totalCount: 2,
            files: [
                {
                    filename: 'file1.txt',
                    longname: '-rw-r--r--    1 user group     1024 Dec 07 16:00 file1.txt',
                    attrs: {
                        size: 1024,
                        mtime: 1701964800,
                        mode: 0o100644,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701964800,
                    },
                },
                {
                    filename: 'subdir',
                    longname: 'drwxr-xr-x    2 user group     4096 Dec 07 15:00 subdir',
                    attrs: {
                        size: 4096,
                        mtime: 1701961200,
                        mode: 0o040755,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701961200,
                    },
                },
            ],
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listRemoteFiles.mockResolvedValue(listResult);

        const result = await listRemoteFiles.handler(
            { connectionName: 'production', remotePath: '/var/www' },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production');
        expect(mockSSHManager.listRemoteFiles).toHaveBeenCalledWith(
            sshConfig,
            '/var/www',
            undefined
        );

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.remotePath).toBe('/var/www');
        expect(response.pattern).toBe('none');
        expect(response.totalCount).toBe(2);
        expect(response.files).toHaveLength(2);

        expect(response.files[0].name).toBe('file1.txt');
        expect(response.files[0].size).toBe(1024);
        expect(response.files[0].isFile).toBe(true);
        expect(response.files[0].isDirectory).toBe(false);
        expect(response.files[0].permissions).toBe('100644');

        expect(response.files[1].name).toBe('subdir');
        expect(response.files[1].size).toBe(4096);
        expect(response.files[1].isFile).toBe(false);
        expect(response.files[1].isDirectory).toBe(true);
        expect(response.files[1].permissions).toBe('40755');
    });

    it('should list files with a pattern filter', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const listResult = {
            totalCount: 1,
            files: [
                {
                    filename: 'app.log',
                    longname: '-rw-r--r--    1 user group     2048 Dec 07 16:00 app.log',
                    attrs: {
                        size: 2048,
                        mtime: 1701964800,
                        mode: 0o100644,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701964800,
                    },
                },
            ],
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listRemoteFiles.mockResolvedValue(listResult);

        const result = await listRemoteFiles.handler(
            {
                connectionName: 'production',
                remotePath: '/var/log',
                pattern: '*.log',
            },
            context
        );

        expect(mockSSHManager.listRemoteFiles).toHaveBeenCalledWith(
            sshConfig,
            '/var/log',
            '*.log'
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.pattern).toBe('*.log');
        expect(response.totalCount).toBe(1);
    });

    it('should throw validation error when remotePath is missing', async () => {
        await expect(
            listRemoteFiles.handler(
                { connectionName: 'production', remotePath: undefined },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when remotePath is empty string', async () => {
        await expect(
            listRemoteFiles.handler(
                { connectionName: 'production', remotePath: '   ' },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            listRemoteFiles.handler(
                { connectionName: 'nonexistent', remotePath: '/var/www' },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should correctly format file timestamps', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const listResult = {
            totalCount: 1,
            files: [
                {
                    filename: 'test.txt',
                    longname: '-rw-r--r--    1 user group      100 Dec 07 16:00 test.txt',
                    attrs: {
                        size: 100,
                        mtime: 1701964800,
                        mode: 0o100644,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701964800,
                    },
                },
            ],
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listRemoteFiles.mockResolvedValue(listResult);

        const result = await listRemoteFiles.handler(
            { connectionName: 'production', remotePath: '/tmp' },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.files[0].modified).toBe('2023-12-07T16:00:00.000Z');
    });

    it('should properly identify files vs directories', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const listResult = {
            totalCount: 2,
            files: [
                {
                    filename: 'regular-file.txt',
                    longname: '-rw-r--r--    1 user group      100 Dec 07 16:00 regular-file.txt',
                    attrs: {
                        size: 100,
                        mtime: 1701964800,
                        mode: 0o100644,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701964800,
                    },
                },
                {
                    filename: 'directory',
                    longname: 'drwxr-xr-x    2 user group     4096 Dec 07 16:00 directory',
                    attrs: {
                        size: 4096,
                        mtime: 1701964800,
                        mode: 0o040755,
                        uid: 1000,
                        gid: 1000,
                        atime: 1701964800,
                    },
                },
            ],
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listRemoteFiles.mockResolvedValue(listResult);

        const result = await listRemoteFiles.handler(
            { connectionName: 'production', remotePath: '/tmp' },
            context
        );

        const response = JSON.parse((result.content[0] as any).text);

        // Regular file
        expect(response.files[0].isFile).toBe(true);
        expect(response.files[0].isDirectory).toBe(false);

        // Directory
        expect(response.files[1].isFile).toBe(false);
        expect(response.files[1].isDirectory).toBe(true);
    });

    it('should propagate SSH manager errors', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.listRemoteFiles.mockRejectedValue(new Error('Permission denied'));

        await expect(
            listRemoteFiles.handler(
                { connectionName: 'production', remotePath: '/root' },
                context
            )
        ).rejects.toThrow('Permission denied');
    });
});
