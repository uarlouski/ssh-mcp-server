import { CommandParser } from '../command-parser.js';

describe('CommandParser', () => {
  describe('extractCommands', () => {
    test('extracts single command', () => {
      expect(CommandParser.extractCommands('ls -la')).toEqual(['ls']);
      expect(CommandParser.extractCommands('pwd')).toEqual(['pwd']);
      expect(CommandParser.extractCommands('echo hello')).toEqual(['echo']);
    });

    test('extracts commands from pipe', () => {
      expect(CommandParser.extractCommands('ls | grep test')).toEqual(['ls', 'grep']);
      expect(CommandParser.extractCommands('cat file.txt | wc -l')).toEqual(['cat', 'wc']);
      expect(CommandParser.extractCommands('ps aux | grep node | awk \'{print $2}\'')).toEqual(['ps', 'grep', 'awk']);
    });

    test('extracts commands from AND operator', () => {
      expect(CommandParser.extractCommands('cd /tmp && ls')).toEqual(['cd', 'ls']);
      expect(CommandParser.extractCommands('mkdir test && cd test && pwd')).toEqual(['mkdir', 'cd', 'pwd']);
    });

    test('extracts commands from OR operator', () => {
      expect(CommandParser.extractCommands('test -f file.txt || echo "not found"')).toEqual(['test', 'echo']);
      expect(CommandParser.extractCommands('which docker || echo "install docker"')).toEqual(['which', 'echo']);
    });

    test('extracts commands from semicolon separator', () => {
      expect(CommandParser.extractCommands('cd /tmp; ls; pwd')).toEqual(['cd', 'ls', 'pwd']);
      expect(CommandParser.extractCommands('echo start; sleep 1; echo end')).toEqual(['echo', 'sleep']);
    });

    test('extracts commands from $() substitution', () => {
      expect(CommandParser.extractCommands('echo $(whoami)')).toEqual(['whoami', 'echo']);
      expect(CommandParser.extractCommands('kill $(ps aux | grep node)')).toEqual(['ps', 'grep', 'kill']);
      expect(CommandParser.extractCommands('docker exec $(docker ps -q) ls')).toEqual(['docker', 'ls']);
    });

    test('extracts commands from backtick substitution', () => {
      expect(CommandParser.extractCommands('echo `whoami`')).toEqual(['whoami', 'echo']);
      expect(CommandParser.extractCommands('kill `ps aux | grep node`')).toEqual(['ps', 'grep', 'kill']);
    });

    test('handles mixed operators', () => {
      expect(CommandParser.extractCommands('ls | grep test && echo found || echo "not found"'))
        .toEqual(['ls', 'grep', 'echo']);
      expect(CommandParser.extractCommands('cd /tmp; ls | wc -l && echo done'))
        .toEqual(['cd', 'ls', 'wc', 'echo']);
    });

    test('handles nested command substitution', () => {
      expect(CommandParser.extractCommands('echo $(echo $(whoami))')).toEqual(['whoami', 'echo']);
      expect(CommandParser.extractCommands('docker exec $(docker ps -q | head -1) bash'))
        .toEqual(['docker', 'head', 'bash']);
    });

    test('deduplicates repeated commands', () => {
      expect(CommandParser.extractCommands('ls && ls && ls')).toEqual(['ls']);
      expect(CommandParser.extractCommands('echo start && echo middle && echo end')).toEqual(['echo']);
    });

    test('handles empty or whitespace strings', () => {
      expect(CommandParser.extractCommands('')).toEqual([]);
      expect(CommandParser.extractCommands('   ')).toEqual([]);
      expect(CommandParser.extractCommands('  |  ')).toEqual([]);
    });

    test('handles complex real-world examples', () => {
      // Kubernetes pod exec with command substitution
      expect(CommandParser.extractCommands('kubectl exec $(kubectl get pods -l app=web -o name | head -1) -- ls'))
        .toEqual(['kubectl', 'head', 'ls']);
      
      // Docker cleanup with pipes and grep
      expect(CommandParser.extractCommands('docker ps -a | grep Exited | awk \'{print $1}\' | xargs docker rm'))
        .toEqual(['docker', 'grep', 'awk', 'xargs']);
      
      // Log analysis with multiple pipes
      expect(CommandParser.extractCommands('cat /var/log/app.log | grep ERROR | tail -n 100 | less'))
        .toEqual(['cat', 'grep', 'tail', 'less']);
    });

    test('handles commands with quotes and special characters', () => {
      expect(CommandParser.extractCommands('echo "hello | world"')).toEqual(['echo']);
      expect(CommandParser.extractCommands('grep "test && prod" file.txt')).toEqual(['grep']);
      expect(CommandParser.extractCommands('find . -name "*.txt" | xargs cat')).toEqual(['find', 'xargs']);
    });
  });

  describe('hasDangerousPatterns', () => {
    test('detects pipe operator', () => {
      expect(CommandParser.hasDangerousPatterns('ls | grep test')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('cat file | wc')).toBe(true);
    });

    test('detects AND operator', () => {
      expect(CommandParser.hasDangerousPatterns('cd /tmp && ls')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('mkdir test && cd test')).toBe(true);
    });

    test('detects OR operator', () => {
      expect(CommandParser.hasDangerousPatterns('test -f file || echo missing')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('which docker || exit 1')).toBe(true);
    });

    test('detects semicolon', () => {
      expect(CommandParser.hasDangerousPatterns('ls; pwd')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('echo start; sleep 1')).toBe(true);
    });

    test('detects $() substitution', () => {
      expect(CommandParser.hasDangerousPatterns('echo $(whoami)')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('kill $(pidof node)')).toBe(true);
    });

    test('detects backtick substitution', () => {
      expect(CommandParser.hasDangerousPatterns('echo `whoami`')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('kill `pidof node`')).toBe(true);
    });

    test('returns false for simple commands', () => {
      expect(CommandParser.hasDangerousPatterns('ls -la')).toBe(false);
      expect(CommandParser.hasDangerousPatterns('pwd')).toBe(false);
      expect(CommandParser.hasDangerousPatterns('echo hello world')).toBe(false);
      expect(CommandParser.hasDangerousPatterns('cat file.txt')).toBe(false);
    });

    test('detects mixed patterns', () => {
      expect(CommandParser.hasDangerousPatterns('ls | grep test && echo found')).toBe(true);
      expect(CommandParser.hasDangerousPatterns('cd /tmp; ls $(pwd)')).toBe(true);
    });
  });
});
