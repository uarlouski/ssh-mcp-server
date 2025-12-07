import { handleListTemplates } from '../handlers/list-templates.js';
import type { HandlerContext } from '../handlers/index.js';
import { ConfigManager } from '../config.js';
import { SSHConnectionManager } from '../ssh-manager.js';

jest.mock('../config.js');
jest.mock('../ssh-manager.js');

describe('handleListTemplates', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockSSHManager: jest.Mocked<SSHConnectionManager>;
  let context: HandlerContext;

  beforeEach(() => {
    mockConfigManager = new ConfigManager('test') as jest.Mocked<ConfigManager>;
    mockSSHManager = new SSHConnectionManager() as jest.Mocked<SSHConnectionManager>;
    
    context = {
      configManager: mockConfigManager,
      sshManager: mockSSHManager,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should return empty list when no templates configured', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([]);

      const result = await handleListTemplates({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.templates).toEqual([]);
      expect(response.count).toBe(0);
    });

    it('should return list of templates with metadata', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'k8s-pod-logs',
          command: 'kubectl logs {{pod}} --tail={{lines:100}}',
          description: 'Get pod logs',
        },
        {
          name: 'docker-stats',
          command: 'docker stats {{container}}',
          description: 'Get container stats',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.count).toBe(2);
      expect(response.templates).toHaveLength(2);
    });

    it('should extract variables from template commands', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'test-template',
          command: 'kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}',
          description: 'Test template',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'namespace', required: true },
        { name: 'pod', required: true },
        { name: 'lines', required: false, defaultValue: '100' },
      ]);
    });

    it('should provide default description when not specified', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'simple-command',
          command: 'ls -la',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].description).toBe('No description provided');
    });
  });

  describe('Variable Extraction', () => {
    it('should detect required variables', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'required-vars',
          command: 'echo {{foo}} {{bar}}',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'foo', required: true },
        { name: 'bar', required: true },
      ]);
    });

    it('should detect optional variables with defaults', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'optional-vars',
          command: 'echo {{foo:default1}} {{bar:default2}}',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'foo', required: false, defaultValue: 'default1' },
        { name: 'bar', required: false, defaultValue: 'default2' },
      ]);
    });

    it('should handle mix of required and optional variables', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'mixed-vars',
          command: 'cmd {{required}} --opt={{optional:default}}',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'required', required: true },
        { name: 'optional', required: false, defaultValue: 'default' },
      ]);
    });

    it('should handle templates with no variables', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'no-vars',
          command: 'docker stats --no-stream',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([]);
    });

    it('should ignore Docker/Go template patterns (dots)', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'docker-format',
          command: 'docker stats {{container}} --format "{{.Name}} {{.CPUPerc}}"',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      // Only {{container}} should be detected, {{.Name}} and {{.CPUPerc}} ignored
      expect(response.templates[0].variables).toEqual([
        { name: 'container', required: true },
      ]);
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted JSON response', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'test',
          command: 'echo {{msg}}',
          description: 'Test command',
        },
      ]);

      const result = await handleListTemplates({}, context);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('templates');
      expect(response).toHaveProperty('count');
    });

    it('should format JSON with proper indentation', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([]);

      const result = await handleListTemplates({}, context);

      // Check that JSON is pretty-printed (contains newlines and spaces)
      expect(result.content[0].text).toContain('\n');
      expect(result.content[0].text).toContain('  '); // 2-space indent
    });

    it('should include all template metadata', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'full-template',
          command: 'kubectl get {{resource}} -n {{namespace:default}}',
          description: 'Get Kubernetes resource',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      const template = response.templates[0];
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('command');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('variables');
    });
  });

  describe('Multiple Templates', () => {
    it('should handle multiple templates correctly', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'template1',
          command: 'cmd1 {{var1}}',
          description: 'First template',
        },
        {
          name: 'template2',
          command: 'cmd2 {{var2:default}}',
          description: 'Second template',
        },
        {
          name: 'template3',
          command: 'cmd3',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.count).toBe(3);
      expect(response.templates).toHaveLength(3);
      expect(response.templates[0].name).toBe('template1');
      expect(response.templates[1].name).toBe('template2');
      expect(response.templates[2].name).toBe('template3');
    });

    it('should correctly count templates', async () => {
      const templates = Array.from({ length: 5 }, (_, i) => ({
        name: `template${i}`,
        command: `cmd${i}`,
      }));

      mockConfigManager.listCommandTemplates.mockReturnValue(templates);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.count).toBe(5);
    });
  });

  describe('Real-World Templates', () => {
    it('should handle Kubernetes template', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'k8s-pod-logs',
          command: 'kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}',
          description: 'Fetch Kubernetes pod logs',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].name).toBe('k8s-pod-logs');
      expect(response.templates[0].variables).toHaveLength(3);
      expect(response.templates[0].variables.find((v: any) => v.name === 'namespace')).toBeTruthy();
      expect(response.templates[0].variables.find((v: any) => v.name === 'pod')).toBeTruthy();
      expect(response.templates[0].variables.find((v: any) => v.name === 'lines')).toMatchObject({
        name: 'lines',
        required: false,
        defaultValue: '100',
      });
    });

    it('should handle Docker template with format string', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'docker-ps',
          command: 'docker ps {{filter:-a}} --format "{{.ID}} - {{.Image}}"',
          description: 'List Docker containers',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      // Should only extract {{filter}}, not Docker format fields
      expect(response.templates[0].variables).toEqual([
        { name: 'filter', required: false, defaultValue: '-a' },
      ]);
    });

    it('should handle deployment template', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'app-deploy',
          command: 'cd /var/www/{{app}} && git pull origin {{branch:main}} && pm2 restart {{app}}',
          description: 'Deploy application',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'app', required: true },
        { name: 'branch', required: false, defaultValue: 'main' },
      ]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty description gracefully', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'test',
          command: 'echo test',
          description: '',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].description).toBe('No description provided');
    });

    it('should handle duplicate variable names', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'duplicate-vars',
          command: 'echo {{var}} and {{var}} again',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      // Should only list variable once
      expect(response.templates[0].variables).toEqual([
        { name: 'var', required: true },
      ]);
    });

    it('should handle special characters in commands', async () => {
      mockConfigManager.listCommandTemplates.mockReturnValue([
        {
          name: 'special-chars',
          command: 'grep "{{pattern}}" {{file}} | sort -u',
        },
      ]);

      const result = await handleListTemplates({}, context);
      const response = JSON.parse(result.content[0].text);

      expect(response.templates[0].variables).toEqual([
        { name: 'pattern', required: true },
        { name: 'file', required: true },
      ]);
    });
  });
});

