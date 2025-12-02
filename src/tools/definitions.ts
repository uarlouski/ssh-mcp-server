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
];
