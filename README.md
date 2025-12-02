# SSH MCP Server

A Model Context Protocol (MCP) server that provides SSH capabilities for remote command execution and port forwarding with comprehensive security controls.

[![npm version](https://badge.fury.io/js/ssh-mcp-server.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- SSH command execution on remote servers
- SSH port forwarding and tunnels
- Persistent connection pooling
- SSH key authentication
- Configurable command and host allowlists

## Installation

todo

## Configuration

Create `config.json`:

```json
{
  "allowedCommands": ["ls", "pwd", "cat", "grep", "docker", "kubectl"],
  "servers": {
    "staging-app": {
      "host": "staging-app-01.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/deploy_key"
    }
  },
  "timeout": 30000,
  "maxConnections": 10
}
```

### Key Options

- `allowedCommands`: Array of allowed command names
  - If specified (non-empty): Enables strict validation of all commands including pipes, chains, and substitutions
  - If omitted or empty: Disables validation (all commands allowed)
- `servers`: Named SSH server configurations
- `timeout`: Connection timeout in ms (default: 30000)
- `maxConnections`: Max concurrent connections (default: 5)

## Available Tools

### ssh_execute_command
Execute commands on remote servers.

```json
{
  "connectionName": "staging-app",
  "command": "kubectl get pods"
}
```

### ssh_port_forward
Set up SSH port forwarding.

```json
{
  "connectionName": "staging-app",
  "localPort": 8080,
  "remoteHost": "internal-db.cluster.local",
  "remotePort": 5432
}
```

### ssh_close_port_forward
Close an active port forward.

```json
{
  "connectionName": "staging-app",
  "localPort": 8080
}
```

### ssh_list_port_forwards
List all active port forwards (no parameters).

## Security

- **Command Validation**: Automatically enabled when `allowedCommands` is specified
  - Validates all commands including pipes (`|`), chains (`&&`, `||`, `;`), and substitutions (`$()`)
  - Blocks bypass attempts like `ls | rm -rf /`
- **Server Allowlist**: Only pre-configured servers in `config.json` can be accessed
- **SSH Key Auth**: Only SSH key authentication is supported

## License

MIT - see [LICENSE](LICENSE) file for details.
