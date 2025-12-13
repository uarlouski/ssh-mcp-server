import { executeTemplate } from '../../tools/templates/execute-template.js';
import type { HandlerContext } from '../../tools/types.js';
import { ConfigManager } from '../../config.js';
import { SSHConnectionManager } from '../../ssh-manager.js';
import { substituteVariables } from '../../template-processor.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

jest.mock('../../config.js');
jest.mock('../../ssh-manager.js');
jest.mock('../../template-processor.js');

function getTextContent(result: CallToolResult): string {
  const content = result.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  throw new Error('Expected text content');
}

describe('handleExecuteTemplate', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockSSHManager: jest.Mocked<SSHConnectionManager>;
  let context: HandlerContext;
  let mockSubstituteVariables: jest.MockedFunction<typeof substituteVariables>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager('test') as jest.Mocked<ConfigManager>;
    mockSSHManager = new SSHConnectionManager() as jest.Mocked<SSHConnectionManager>;
    mockSubstituteVariables = substituteVariables as jest.MockedFunction<typeof substituteVariables>;

    context = {
      configManager: mockConfigManager,
      sshManager: mockSSHManager,
    };

    // Default mocks
    mockConfigManager.getCommandTemplate.mockReturnValue('echo {{message}}');
    mockSubstituteVariables.mockReturnValue('echo Hello');
    mockConfigManager.isCommandAllowed.mockReturnValue(true);
    mockConfigManager.getCommandTimeout.mockReturnValue(30000);
    mockConfigManager.getServer.mockReturnValue({
      host: 'test.example.com',
      port: 22,
      username: 'testuser',
      privateKeyPath: '/test/key',
    });
    mockSSHManager.executeCommand.mockResolvedValue({
      stdout: 'Hello',
      stderr: '',
      exitCode: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error when connectionName is missing', async () => {
      await expect(
        executeTemplate.handler(
          { connectionName: '', templateName: 'test', variables: {} },
          context
        )
      ).rejects.toThrow('connectionName is required');
    });

    it('should throw error when connectionName is undefined', async () => {
      await expect(
        executeTemplate.handler(
          { connectionName: undefined as any, templateName: 'test', variables: {} },
          context
        )
      ).rejects.toThrow('connectionName is required');
    });

    it('should throw error when templateName is missing', async () => {
      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: '', variables: {} },
          context
        )
      ).rejects.toThrow('templateName is required');
    });

    it('should throw error when templateName is undefined', async () => {
      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: undefined as any, variables: {} },
          context
        )
      ).rejects.toThrow('templateName is required');
    });

    it('should accept request without variables', async () => {
      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test' },
        context
      );

      expect(result.content).toHaveLength(1);
      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
    });
  });

  describe('Template Processing', () => {
    it('should get template from config manager', async () => {
      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'my-template', variables: {} },
        context
      );

      expect(mockConfigManager.getCommandTemplate).toHaveBeenCalledWith('my-template');
    });

    it('should substitute variables in template', async () => {
      const variables = { message: 'Hello World' };

      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables },
        context
      );

      expect(mockSubstituteVariables).toHaveBeenCalledWith(
        'echo {{message}}',
        variables
      );
    });

    it('should handle templates without variables', async () => {
      mockConfigManager.getCommandTemplate.mockReturnValue('ls -la');
      mockSubstituteVariables.mockReturnValue('ls -la');

      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'simple' },
        context
      );

      expect(mockSubstituteVariables).toHaveBeenCalled();
    });
  });

  describe('Command Authorization', () => {
    it('should check if expanded command is allowed', async () => {
      const expandedCommand = 'echo Hello';
      mockSubstituteVariables.mockReturnValue(expandedCommand);

      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      expect(mockConfigManager.isCommandAllowed).toHaveBeenCalledWith(expandedCommand);
    });

    it('should throw error when command is not allowed', async () => {
      mockConfigManager.isCommandAllowed.mockReturnValue(false);
      mockSubstituteVariables.mockReturnValue('rm -rf /');

      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: 'dangerous', variables: {} },
          context
        )
      ).rejects.toThrow('Command not allowed');

      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: 'dangerous', variables: {} },
          context
        )
      ).rejects.toThrow('rm -rf /');
    });

    it('should allow command when allowedCommands check passes', async () => {
      mockConfigManager.isCommandAllowed.mockReturnValue(true);

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'safe', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
    });
  });

  describe('SSH Execution', () => {
    it('should get server configuration', async () => {
      await executeTemplate.handler(
        { connectionName: 'my-server', templateName: 'test', variables: {} },
        context
      );

      expect(mockConfigManager.getServer).toHaveBeenCalledWith('my-server');
    });

    it('should execute command on remote server', async () => {
      const sshConfig = {
        host: 'test.example.com',
        port: 22,
        username: 'testuser',
        privateKeyPath: '/test/key',
      };
      const expandedCommand = 'kubectl get pods';

      mockConfigManager.getServer.mockReturnValue(sshConfig);
      mockSubstituteVariables.mockReturnValue(expandedCommand);

      await executeTemplate.handler(
        { connectionName: 'k8s', templateName: 'get-pods', variables: {} },
        context
      );

      expect(mockSSHManager.executeCommand).toHaveBeenCalledWith(
        sshConfig,
        expandedCommand,
        30000
      );
    });

    it('should use per-command commandTimeout override when provided', async () => {
      const sshConfig = {
        host: 'test.example.com',
        port: 22,
        username: 'testuser',
        privateKeyPath: '/test/key',
      };

      mockConfigManager.getServer.mockReturnValue(sshConfig);
      mockSubstituteVariables.mockReturnValue('echo Hello');

      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {}, commandTimeout: 1234 },
        context
      );

      expect(mockSSHManager.executeCommand).toHaveBeenCalledWith(sshConfig, 'echo Hello', 1234);
    });

    it('should handle command execution success', async () => {
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: 'pod-1\npod-2\npod-3',
        stderr: '',
        exitCode: 0,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
      expect(response.result.stdout).toBe('pod-1\npod-2\npod-3');
      expect(response.result.exitCode).toBe(0);
    });

    it('should handle command execution with stderr', async () => {
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: 'output',
        stderr: 'warning message',
        exitCode: 0,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.result.stderr).toBe('warning message');
    });

    it('should handle command execution failure', async () => {
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.result.exitCode).toBe(127);
      expect(response.result.stderr).toBe('command not found');
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted response', async () => {
      const result = await executeTemplate.handler(
        {
          connectionName: 'server',
          templateName: 'test-template',
          variables: { key: 'value' }
        },
        context
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(getTextContent(result));
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('templateName');
      expect(response).toHaveProperty('expandedCommand');
      expect(response).toHaveProperty('variables');
      expect(response).toHaveProperty('result');
    });

    it('should include template name in response', async () => {
      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'my-template', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.templateName).toBe('my-template');
    });

    it('should include expanded command in response', async () => {
      const expandedCommand = 'kubectl logs -n production api-123';
      mockSubstituteVariables.mockReturnValue(expandedCommand);

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.expandedCommand).toBe(expandedCommand);
    });

    it('should include provided variables in response', async () => {
      const variables = { namespace: 'production', pod: 'api-123' };

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.variables).toEqual(variables);
    });

    it('should return empty object for variables when not provided', async () => {
      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test' },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.variables).toEqual({});
    });

    it('should include execution result in response', async () => {
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: 'test output',
        stderr: 'test error',
        exitCode: 1,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.result).toEqual({
        stdout: 'test output',
        stderr: 'test error',
        exitCode: 1,
        timedOut: false,
      });
    });

    it('should format JSON with proper indentation', async () => {
      const result = await executeTemplate.handler(
        { connectionName: 'server', templateName: 'test', variables: {} },
        context
      );

      expect(getTextContent(result)).toContain('\n');
      expect(getTextContent(result)).toContain('  '); // 2-space indent
    });
  });

  describe('Real-World Scenarios', () => {
    it('should execute Kubernetes pod logs template', async () => {
      const template = 'kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}';
      const variables = { namespace: 'production', pod: 'api-7d8f9', lines: '50' };
      const expandedCommand = 'kubectl logs -n production api-7d8f9 --tail=50';

      mockConfigManager.getCommandTemplate.mockReturnValue(template);
      mockSubstituteVariables.mockReturnValue(expandedCommand);
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: '[2024-12-06] Starting application...',
        stderr: '',
        exitCode: 0,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'k8s-server', templateName: 'k8s-pod-logs', variables },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
      expect(response.expandedCommand).toBe(expandedCommand);
      expect(response.variables).toEqual(variables);
    });

    it('should execute Docker stats template with format string', async () => {
      const template = 'docker stats {{container}} --format "{{.Name}} {{.CPUPerc}}"';
      const variables = { container: 'web-app' };
      const expandedCommand = 'docker stats web-app --format "{{.Name}} {{.CPUPerc}}"';

      mockConfigManager.getCommandTemplate.mockReturnValue(template);
      mockSubstituteVariables.mockReturnValue(expandedCommand);
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: 'web-app 15.23%',
        stderr: '',
        exitCode: 0,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'docker-host', templateName: 'docker-stats', variables },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.expandedCommand).toBe(expandedCommand);
      expect(response.result.stdout).toBe('web-app 15.23%');
    });

    it('should execute deployment template', async () => {
      const template = 'cd /var/www/{{app}} && git pull origin {{branch:main}} && pm2 restart {{app}}';
      const variables = { app: 'api', branch: 'develop' };
      const expandedCommand = 'cd /var/www/api && git pull origin develop && pm2 restart api';

      mockConfigManager.getCommandTemplate.mockReturnValue(template);
      mockSubstituteVariables.mockReturnValue(expandedCommand);
      mockSSHManager.executeCommand.mockResolvedValue({
        stdout: 'Deployed successfully',
        stderr: '',
        exitCode: 0,
      });

      const result = await executeTemplate.handler(
        { connectionName: 'app-server', templateName: 'app-deploy', variables },
        context
      );

      const response = JSON.parse(getTextContent(result));
      expect(response.success).toBe(true);
      expect(response.expandedCommand).toBe(expandedCommand);
    });

    it('should use default values when variables not provided', async () => {
      const template = 'df -h {{path:/}}';
      const variables = {};
      const expandedCommand = 'df -h /';

      mockConfigManager.getCommandTemplate.mockReturnValue(template);
      mockSubstituteVariables.mockReturnValue(expandedCommand);

      await executeTemplate.handler(
        { connectionName: 'server', templateName: 'disk-usage', variables },
        context
      );

      expect(mockSubstituteVariables).toHaveBeenCalledWith(template, variables);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate template not found error', async () => {
      mockConfigManager.getCommandTemplate.mockImplementation(() => {
        throw new Error("Command template 'nonexistent' not found in config.json");
      });

      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: 'nonexistent', variables: {} },
          context
        )
      ).rejects.toThrow('not found');
    });

    it('should propagate variable substitution error', async () => {
      mockSubstituteVariables.mockImplementation(() => {
        throw new Error('Missing required template variable: pod');
      });

      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: 'test', variables: {} },
          context
        )
      ).rejects.toThrow('Missing required template variable');
    });

    it('should propagate server not found error', async () => {
      mockConfigManager.getServer.mockImplementation(() => {
        throw new Error("Server configuration 'nonexistent' not found");
      });

      await expect(
        executeTemplate.handler(
          { connectionName: 'nonexistent', templateName: 'test', variables: {} },
          context
        )
      ).rejects.toThrow('not found');
    });

    it('should propagate SSH execution error', async () => {
      mockSSHManager.executeCommand.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        executeTemplate.handler(
          { connectionName: 'server', templateName: 'test', variables: {} },
          context
        )
      ).rejects.toThrow('Connection timeout');
    });
  });
});

