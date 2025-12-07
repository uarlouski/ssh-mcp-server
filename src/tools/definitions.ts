import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tools: Tool[] = [
  {
    name: 'ssh_execute_command',
    description: 'Execute a command on a remote SSH server. The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        command: {
          type: 'string',
          description: 'Command to execute on the remote server',
        },
      },
      required: ['connectionName', 'command'],
    },
  },
  {
    name: 'ssh_port_forward',
    description: 'Set up SSH port forwarding (local port to remote host:port). The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        localPort: {
          type: 'number',
          description: 'Local port to listen on',
        },
        remoteHost: {
          type: 'string',
          description: 'Remote host to forward to (from SSH server perspective)',
        },
        remotePort: {
          type: 'number',
          description: 'Remote port to forward to',
        },
      },
      required: ['connectionName', 'localPort', 'remoteHost', 'remotePort'],
    },
  },
  {
    name: 'ssh_port_forward_service',
    description: 'Start a pre-configured named port forwarding service from config.json. The service must be defined in the portForwardingServices section of the configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Name of the port forwarding service defined in config.json',
        },
      },
      required: ['serviceName'],
    },
  },
  {
    name: 'ssh_close_port_forward',
    description: 'Close an active SSH port forwarding tunnel. Only connectionName and localPort are needed.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        localPort: {
          type: 'number',
          description: 'Local port that was forwarded',
        },
      },
      required: ['connectionName', 'localPort'],
    },
  },
  {
    name: 'ssh_list_port_forwards',
    description: 'List all active SSH port forwarding tunnels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ssh_upload_file',
    description: 'Upload a file from local system to remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        localPath: {
          type: 'string',
          description: 'Local file path to upload',
        },
        remotePath: {
          type: 'string',
          description: 'Remote destination path',
        },
        permissions: {
          type: 'string',
          description: 'Optional file permissions in octal format (e.g., "0644", "0755")',
        },
      },
      required: ['connectionName', 'localPath', 'remotePath'],
    },
  },
  {
    name: 'ssh_download_file',
    description: 'Download a file from remote server to local system via SFTP. The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        remotePath: {
          type: 'string',
          description: 'Remote file path to download',
        },
        localPath: {
          type: 'string',
          description: 'Local destination path',
        },
      },
      required: ['connectionName', 'remotePath', 'localPath'],
    },
  },
  {
    name: 'ssh_list_remote_files',
    description: 'List files in a remote directory via SFTP. The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        remotePath: {
          type: 'string',
          description: 'Remote directory path to list',
        },
        pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g., "*.log", "*.json")',
        },
      },
      required: ['connectionName', 'remotePath'],
    },
  },
  {
    name: 'ssh_delete_remote_file',
    description: 'Delete a file on the remote server via SFTP. The connectionName must reference a pre-configured server in config.json.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        remotePath: {
          type: 'string',
          description: 'Remote file path to delete',
        },
      },
      required: ['connectionName', 'remotePath'],
    },
  },
  {
    name: 'ssh_execute_template',
    description: 'Execute a pre-configured command template with variable substitution. Templates are defined in the commandTemplates section of config.json and support ${variable} and ${variable:-defaultValue} syntax.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionName: {
          type: 'string',
          description: 'Name of a pre-configured SSH server from config.json',
        },
        templateName: {
          type: 'string',
          description: 'Name of the command template defined in config.json',
        },
        variables: {
          type: 'object',
          description: 'Key-value pairs for template variable substitution',
          additionalProperties: {
            type: 'string',
          },
        },
      },
      required: ['connectionName', 'templateName'],
    },
  },
  {
    name: 'ssh_list_templates',
    description: 'List all available command templates defined in config.json with their descriptions and required variables.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
