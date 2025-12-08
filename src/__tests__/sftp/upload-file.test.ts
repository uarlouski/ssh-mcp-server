import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { uploadFile } from '../../tools/sftp/upload-file.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import type { HandlerContext } from '../../tools/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');

describe('handleUploadFile', () => {
    let mockConfigManager: jest.Mocked<ConfigManager>;
    let mockSSHManager: jest.Mocked<SSHConnectionManager>;
    let context: HandlerContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigManager = {
            getServer: jest.fn(),
        } as any;

        mockSSHManager = {
            uploadFile: jest.fn(),
        } as any;

        context = {
            configManager: mockConfigManager,
            sshManager: mockSSHManager,
        };
    });

    it('should successfully upload a file without permissions', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const uploadResult = {
            success: true,
            bytesTransferred: 2048,
            message: 'File uploaded successfully',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.uploadFile.mockResolvedValue(uploadResult);

        const result = await uploadFile.handler(
            {
                connectionName: 'production',
                localPath: '/tmp/app.tar.gz',
                remotePath: '/var/www/app.tar.gz',
            },
            context
        );

        expect(mockConfigManager.getServer).toHaveBeenCalledWith('production');
        expect(mockSSHManager.uploadFile).toHaveBeenCalledWith(
            sshConfig,
            '/tmp/app.tar.gz',
            '/var/www/app.tar.gz',
            undefined
        );

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
        expect(response.bytesTransferred).toBe(2048);
        expect(response.message).toBe('File uploaded successfully');
        expect(response.localPath).toBe('/tmp/app.tar.gz');
        expect(response.remotePath).toBe('/var/www/app.tar.gz');
    });

    it('should successfully upload a file with valid permissions', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const uploadResult = {
            success: true,
            bytesTransferred: 512,
            message: 'File uploaded successfully',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.uploadFile.mockResolvedValue(uploadResult);

        const result = await uploadFile.handler(
            {
                connectionName: 'production',
                localPath: '/tmp/script.sh',
                remotePath: '/usr/local/bin/script.sh',
                permissions: '0755',
            },
            context
        );

        expect(mockSSHManager.uploadFile).toHaveBeenCalledWith(
            sshConfig,
            '/tmp/script.sh',
            '/usr/local/bin/script.sh',
            '0755'
        );

        const response = JSON.parse((result.content[0] as any).text);
        expect(response.success).toBe(true);
    });

    it('should throw validation error when localPath is missing', async () => {
        await expect(
            uploadFile.handler(
                {
                    connectionName: 'production',
                    localPath: undefined,
                    remotePath: '/var/www/file.txt',
                },
                context
            )
        ).rejects.toThrow('localPath is required and must be a non-empty string');
    });

    it('should throw validation error when remotePath is missing', async () => {
        await expect(
            uploadFile.handler(
                {
                    connectionName: 'production',
                    localPath: '/tmp/file.txt',
                    remotePath: undefined,
                },
                context
            )
        ).rejects.toThrow('remotePath is required and must be a non-empty string');
    });

    it('should throw validation error when permissions format is invalid', async () => {
        await expect(
            uploadFile.handler(
                {
                    connectionName: 'production',
                    localPath: '/tmp/file.txt',
                    remotePath: '/var/www/file.txt',
                    permissions: '999',
                },
                context
            )
        ).rejects.toThrow('permissions must be a valid octal string');
    });

    it('should accept permissions without leading zero', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const uploadResult = {
            success: true,
            bytesTransferred: 100,
            message: 'File uploaded successfully',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.uploadFile.mockResolvedValue(uploadResult);

        await uploadFile.handler(
            {
                connectionName: 'production',
                localPath: '/tmp/file.txt',
                remotePath: '/var/www/file.txt',
                permissions: '644',
            },
            context
        );

        expect(mockSSHManager.uploadFile).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.anything(),
            '644'
        );
    });

    it('should throw error when upload fails', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        const uploadResult = {
            success: false,
            bytesTransferred: 0,
            message: 'Local file not found',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.uploadFile.mockResolvedValue(uploadResult);

        await expect(
            uploadFile.handler(
                {
                    connectionName: 'production',
                    localPath: '/tmp/nonexistent.txt',
                    remotePath: '/var/www/file.txt',
                },
                context
            )
        ).rejects.toThrow('Local file not found');
    });

    it('should throw error when server configuration is not found', async () => {
        mockConfigManager.getServer.mockImplementation(() => {
            throw new Error("Server configuration 'nonexistent' not found in config.json");
        });

        await expect(
            uploadFile.handler(
                {
                    connectionName: 'nonexistent',
                    localPath: '/tmp/file.txt',
                    remotePath: '/var/www/file.txt',
                },
                context
            )
        ).rejects.toThrow("Server configuration 'nonexistent' not found in config.json");
    });

    it('should propagate SSH manager errors', async () => {
        const sshConfig = {
            host: 'server.example.com',
            port: 22,
            username: 'user',
            privateKeyPath: '/path/to/key',
        };

        mockConfigManager.getServer.mockReturnValue(sshConfig);
        mockSSHManager.uploadFile.mockRejectedValue(new Error('Disk quota exceeded'));

        await expect(
            uploadFile.handler(
                {
                    connectionName: 'production',
                    localPath: '/tmp/largefile.bin',
                    remotePath: '/var/www/largefile.bin',
                },
                context
            )
        ).rejects.toThrow('Disk quota exceeded');
    });
});
