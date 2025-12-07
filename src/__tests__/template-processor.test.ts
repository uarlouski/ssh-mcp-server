import { substituteVariables, extractVariables } from '../template-processor.js';

describe('Template Processor', () => {
  describe('substituteVariables', () => {
    describe('Basic Variable Substitution', () => {
      it('should substitute a simple variable', () => {
        const result = substituteVariables('Hello {{name}}', { name: 'World' });
        expect(result).toBe('Hello World');
      });

      it('should substitute multiple variables', () => {
        const result = substituteVariables('{{greeting}} {{name}}!', {
          greeting: 'Hello',
          name: 'World',
        });
        expect(result).toBe('Hello World!');
      });

      it('should substitute same variable multiple times', () => {
        const result = substituteVariables('{{x}} + {{x}} = {{result}}', {
          x: '5',
          result: '10',
        });
        expect(result).toBe('5 + 5 = 10');
      });

      it('should handle variables with hyphens and underscores', () => {
        const result = substituteVariables('{{pod-name}} {{user_id}}', {
          'pod-name': 'api-123',
          user_id: 'user-456',
        });
        expect(result).toBe('api-123 user-456');
      });
    });

    describe('Default Values', () => {
      it('should use provided value over default', () => {
        const result = substituteVariables('{{name:default}}', { name: 'custom' });
        expect(result).toBe('custom');
      });

      it('should use default when variable not provided', () => {
        const result = substituteVariables('{{name:World}}', {});
        expect(result).toBe('World');
      });

      it('should handle numeric defaults', () => {
        const result = substituteVariables('--tail={{lines:100}}', {});
        expect(result).toBe('--tail=100');
      });

      it('should handle empty string as default', () => {
        const result = substituteVariables('{{value:}}', {});
        expect(result).toBe('');
      });

      it('should mix required and optional variables', () => {
        const result = substituteVariables('kubectl logs {{pod}} --tail={{lines:100}}', {
          pod: 'api-123',
        });
        expect(result).toBe('kubectl logs api-123 --tail=100');
      });
    });

    describe('Docker/Go Template Preservation', () => {
      it('should preserve Docker format patterns with dots', () => {
        const result = substituteVariables(
          'docker stats --format "{{.Name}}"',
          {}
        );
        expect(result).toBe('docker stats --format "{{.Name}}"');
      });

      it('should preserve multiple Docker fields', () => {
        const result = substituteVariables(
          'docker stats --format "{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"',
          {}
        );
        expect(result).toBe('docker stats --format "{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"');
      });

      it('should mix template variables with Docker patterns', () => {
        const result = substituteVariables(
          'docker stats {{container}} --format "{{.Name}} {{.CPUPerc}}"',
          { container: 'web-server' }
        );
        expect(result).toBe('docker stats web-server --format "{{.Name}} {{.CPUPerc}}"');
      });

      it('should handle complex Docker format string', () => {
        const result = substituteVariables(
          'docker ps {{filter:}} --format "table {{.ID}}\\t{{.Image}}\\t{{.Status}}"',
          { filter: '-a' }
        );
        expect(result).toBe('docker ps -a --format "table {{.ID}}\\t{{.Image}}\\t{{.Status}}"');
      });

      it('should preserve Go template conditionals', () => {
        const result = substituteVariables(
          'kubectl get pods --template="{{.items}}"',
          {}
        );
        expect(result).toBe('kubectl get pods --template="{{.items}}"');
      });

      it('should preserve nested Docker template fields', () => {
        const result = substituteVariables(
          'docker inspect --format "{{.Config.Image}}"',
          {}
        );
        expect(result).toBe('docker inspect --format "{{.Config.Image}}"');
      });
    });

    describe('Error Handling', () => {
      it('should throw error for missing required variable', () => {
        expect(() => {
          substituteVariables('Hello {{name}}', {});
        }).toThrow('Missing required template variable: name');
      });

      it('should throw error for multiple missing variables', () => {
        expect(() => {
          substituteVariables('{{first}} {{second}}', {});
        }).toThrow('Missing required template variables: first, second');
      });

      it('should not throw for Docker patterns (dots)', () => {
        expect(() => {
          substituteVariables('docker stats --format "{{.Name}}"', {});
        }).not.toThrow();
      });

      it('should throw for missing variable even with Docker patterns present', () => {
        expect(() => {
          substituteVariables('docker stats {{container}} --format "{{.Name}}"', {});
        }).toThrow('Missing required template variable: container');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty template', () => {
        const result = substituteVariables('', {});
        expect(result).toBe('');
      });

      it('should handle template with no variables', () => {
        const result = substituteVariables('plain text', {});
        expect(result).toBe('plain text');
      });

      it('should handle undefined variables object', () => {
        const result = substituteVariables('{{name:default}}', undefined);
        expect(result).toBe('default');
      });

      it('should handle special characters in values', () => {
        const result = substituteVariables('{{cmd}}', { cmd: 'ls -la | grep test' });
        expect(result).toBe('ls -la | grep test');
      });

      it('should handle values with braces', () => {
        const result = substituteVariables('{{json}}', { json: '{"key":"value"}' });
        expect(result).toBe('{"key":"value"}');
      });
    });
  });

  describe('extractVariables', () => {
    describe('Basic Variable Extraction', () => {
      it('should extract single variable', () => {
        const vars = extractVariables('Hello {{name}}');
        expect(vars).toEqual([{ name: 'name', required: true }]);
      });

      it('should extract multiple variables', () => {
        const vars = extractVariables('{{greeting}} {{name}}');
        expect(vars).toEqual([
          { name: 'greeting', required: true },
          { name: 'name', required: true },
        ]);
      });

      it('should handle duplicate variables', () => {
        const vars = extractVariables('{{x}} + {{x}} = {{result}}');
        expect(vars).toEqual([
          { name: 'x', required: true },
          { name: 'result', required: true },
        ]);
      });

      it('should extract optional variables with defaults', () => {
        const vars = extractVariables('{{name:World}}');
        expect(vars).toEqual([
          { name: 'name', required: false, defaultValue: 'World' },
        ]);
      });

      it('should mix required and optional variables', () => {
        const vars = extractVariables('kubectl logs {{pod}} --tail={{lines:100}}');
        expect(vars).toEqual([
          { name: 'pod', required: true },
          { name: 'lines', required: false, defaultValue: '100' },
        ]);
      });
    });

    describe('Docker/Go Template Filtering', () => {
      it('should ignore Docker format patterns', () => {
        const vars = extractVariables('docker stats --format "{{.Name}}"');
        expect(vars).toEqual([]);
      });

      it('should ignore multiple Docker fields', () => {
        const vars = extractVariables('--format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"');
        expect(vars).toEqual([]);
      });

      it('should extract template variables but ignore Docker patterns', () => {
        const vars = extractVariables(
          'docker stats {{container}} --format "{{.Name}} {{.CPUPerc}}"'
        );
        expect(vars).toEqual([{ name: 'container', required: true }]);
      });

      it('should ignore nested Docker fields', () => {
        const vars = extractVariables('docker inspect --format "{{.Config.Image}}"');
        expect(vars).toEqual([]);
      });

      it('should handle complex mix of both', () => {
        const vars = extractVariables(
          'docker ps {{filter:-a}} --format "table {{.ID}}\\t{{.Image}}"'
        );
        expect(vars).toEqual([
          { name: 'filter', required: false, defaultValue: '-a' },
        ]);
      });
    });

    describe('Edge Cases', () => {
      it('should return empty array for no variables', () => {
        const vars = extractVariables('plain text');
        expect(vars).toEqual([]);
      });

      it('should return empty array for empty string', () => {
        const vars = extractVariables('');
        expect(vars).toEqual([]);
      });

      it('should handle variables with special characters', () => {
        const vars = extractVariables('{{pod-name}} {{user_id}}');
        expect(vars).toEqual([
          { name: 'pod-name', required: true },
          { name: 'user_id', required: true },
        ]);
      });

      it('should handle empty default value', () => {
        const vars = extractVariables('{{value:}}');
        expect(vars).toEqual([
          { name: 'value', required: false, defaultValue: '' },
        ]);
      });
    });
  });

  describe('Real-World Examples', () => {
    it('should handle Kubernetes pod logs template', () => {
      const template = 'kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}';
      const vars = extractVariables(template);
      const result = substituteVariables(template, {
        namespace: 'production',
        pod: 'api-7d8f9',
        lines: '50',
      });

      expect(vars).toEqual([
        { name: 'namespace', required: true },
        { name: 'pod', required: true },
        { name: 'lines', required: false, defaultValue: '100' },
      ]);
      expect(result).toBe('kubectl logs -n production api-7d8f9 --tail=50');
    });

    it('should handle Docker stats with format template', () => {
      const template = 'docker stats {{container}} --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"';
      const vars = extractVariables(template);
      const result = substituteVariables(template, { container: 'web-app' });

      expect(vars).toEqual([{ name: 'container', required: true }]);
      expect(result).toBe(
        'docker stats web-app --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"'
      );
    });

    it('should handle application deployment template', () => {
      const template = 'cd /var/www/{{app}} && git pull origin {{branch:main}} && npm install && pm2 restart {{app}}';
      const vars = extractVariables(template);
      const result = substituteVariables(template, { app: 'api' });

      expect(vars).toEqual([
        { name: 'app', required: true },
        { name: 'branch', required: false, defaultValue: 'main' },
      ]);
      expect(result).toBe('cd /var/www/api && git pull origin main && npm install && pm2 restart api');
    });

    it('should handle disk usage template', () => {
      const template = 'df -h {{path:/}}';
      const vars = extractVariables(template);
      const result = substituteVariables(template, {});

      expect(vars).toEqual([
        { name: 'path', required: false, defaultValue: '/' },
      ]);
      expect(result).toBe('df -h /');
    });
  });
});

