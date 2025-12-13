# SSH MCP Server

A Model Context Protocol (MCP) server that provides secure SSH capabilities for AI assistants, enabling remote command execution, SFTP file transfers, and port forwarding with comprehensive security controls.

[![npm version](https://badge.fury.io/js/@uarlouski%2Fssh-mcp-server.svg)](https://www.npmjs.com/package/@uarlouski/ssh-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@uarlouski/ssh-mcp-server.svg)](https://www.npmjs.com/package/@uarlouski/ssh-mcp-server)
[![CI](https://github.com/uarlouski/ssh-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/uarlouski/ssh-mcp-server/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/node/v/@uarlouski/ssh-mcp-server.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/uarlouski/ssh-mcp-server.svg?style=social&label=Star)](https://github.com/uarlouski/ssh-mcp-server)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Security](#security)
- [Examples](#examples)
- [License](#license)

## Features

- 🔐 **Secure SSH Command Execution** - Execute commands on remote servers with granular security controls
- 🛡️ **Host Allowlisting** - Only connect to pre-configured, trusted servers
- 📁 **SFTP File Operations** - Upload, download, list, and delete files on remote servers
- 🌉 **SSH Port Forwarding** - Create secure tunnels to access remote services
- 🔄 **Connection Pooling** - Persistent connections with automatic management
- 🔑 **SSH Key Authentication** - Secure authentication using SSH private keys
- ✅ **Command Allowlisting** - Restrict which commands can be executed
- 📦 **Named Services** - Pre-configured port forwarding services for common use cases
- 🎯 **Command Templates** - Reusable parameterized commands with variable substitution

## Installation

### As an MCP Server

The recommended way to use this package is as an MCP server with AI assistants like GitHub Copilot.

**Prerequisites:**
- Node.js 18.0.0 or higher
- SSH access to target servers
- SSH private keys configured

**Using npx (recommended):**

No installation required! Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "@uarlouski/ssh-mcp-server@latest",
        "--configPath=/path/to/your/ssh-mcp-config.json"
      ]
    }
  }
}
```

**Global installation:**

```bash
npm install -g @uarlouski/ssh-mcp-server
```

Then configure with:

```json
{
  "mcpServers": {
    "ssh": {
      "command": "ssh-mcp-server",
      "args": ["--configPath=/path/to/your/ssh-mcp-config.json"]
    }
  }
}
```

## Quick Start

### 1. Create SSH Keys

If you don't already have SSH keys for your servers:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C "deploy@example.com"
ssh-copy-id -i ~/.ssh/deploy_key.pub user@your-server.com
```

### 2. Create Configuration File

Create a `ssh-mcp-config.json` file:

```json
{
  "allowedCommands": ["ls", "cat", "grep", "docker", "kubectl"],
  "servers": {
    "my-server": {
      "host": "example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/deploy_key"
    }
  }
}
```

### 3. Configure Your MCP Client

Add the server to your MCP client (e.g., GitHub Copilot):

```json
{
  "mcpServers": {
    "ssh": {
      "command": "npx",
      "args": [
        "@uarlouski/ssh-mcp-server@latest",
        "--configPath=/Users/yourname/ssh-mcp-config.json"
      ]
    }
  }
}
```

### 4. Restart Your MCP Client

Restart your AI assistant to load the new server configuration.

## Configuration

### Basic Configuration

The configuration file supports the following options:

```json
{
  "allowedCommands": ["ls", "pwd", "cat", "grep", "docker", "kubectl"],
  "servers": {
    "server-name": {
      "host": "hostname-or-ip",
      "port": 22,
      "username": "username",
      "privateKeyPath": "~/.ssh/private_key"
    }
  },
  "portForwardingServices": {
    "service-name": {
      "connectionName": "server-name",
      "localPort": 8080,
      "remoteHost": "localhost",
      "remotePort": 80,
      "description": "Optional description"
    }
  },
  "commandTemplates": {
    "k8s-pod-logs": {
      "command": "kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}",
      "description": "Fetch Kubernetes pod logs with configurable tail size"
    },
    "app-deploy": {
      "command": "cd /var/www/{{app}} && git pull origin {{branch:main}} && npm install && pm2 restart {{app}}",
      "description": "Deploy application with git pull, npm install, and pm2 restart"
    },
    "docker-stats": "docker stats {{container:--all}} --no-stream --format 'table {{.Name}}\\t{{.CPUPerc}}'"
  },
  "commandTimeout": 30000,
  "maxConnections": 10
}
```

### Configuration Options

#### `allowedCommands` (optional)

Array of base command names that are permitted for execution.

- **If specified (non-empty)**: Enables strict validation
  - Only listed commands can be executed
  - Validates complex commands including pipes (`|`), chains (`&&`, `||`, `;`), and substitutions (`$()`)
  - Blocks bypass attempts like `ls | rm -rf /`
- **If omitted or empty**: Disables validation (all commands allowed - use with caution!)

**Example:**
```json
"allowedCommands": ["ls", "cat", "grep", "docker", "kubectl", "systemctl"]
```

#### `servers` (required)

Named SSH server configurations. Each server must have:

- `host` (required): Hostname or IP address
- `username` (required): SSH username
- `privateKeyPath` (required): Path to SSH private key (supports `~` expansion)
- `port` (optional): SSH port (default: 22)

**Example:**
```json
"servers": {
  "staging-api": {
    "host": "api-staging-01.example.com",
    "username": "deploy",
    "privateKeyPath": "~/.ssh/staging_deploy_key"
  },
  "staging-db": {
    "host": "db-staging-master.example.com",
    "port": 2222,
    "username": "dbadmin",
    "privateKeyPath": "~/.ssh/db_admin_key"
  }
}
```

#### `portForwardingServices` (optional)

Pre-configured named port forwarding services for common use cases.

- `connectionName` (required): Name of the server from `servers` config
- `remoteHost` (required): Remote host to forward to
- `remotePort` (required): Remote port to forward to
- `localPort` (optional): Local port to bind to (random if omitted)
- `description` (optional): Human-readable description

**Example:**
```json
"portForwardingServices": {
  "pg-staging-database": {
    "connectionName": "staging-db",
    "remoteHost": "db-internal-01.example.com",
    "remotePort": 5432,
    "description": "PostgreSQL database access"
  }
}
```

#### `commandTemplates` (optional)

Reusable parameterized command templates with variable substitution.

Templates can be defined in two formats:
- **String format**: `"template-name": "command with {{variables}}"`
- **Object format**: `"template-name": { "command": "...", "description": "..." }`

**Variable syntax:**
- `{{variable}}` - Required variable
- `{{variable:default}}` - Optional variable with default value
- `{{.field}}` - Preserved for Docker/Go templates (not substituted)

**Example:**
```json
"commandTemplates": {
  "k8s-pod-logs": {
    "command": "kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}",
    "description": "Fetch Kubernetes pod logs with configurable tail size"
  },
  "app-deploy": {
    "command": "cd /var/www/{{app}} && git pull origin {{branch:main}} && npm install && pm2 restart {{app}}",
    "description": "Deploy application"
  },
  "docker-stats": "docker stats {{container:--all}} --no-stream --format 'table {{.Name}}\\t{{.CPUPerc}}'",
  "nginx-reload": "sudo nginx -t && sudo systemctl reload nginx"
}
```

**Usage with AI:**
```
"Get logs from the api-7d8f9 pod in the staging namespace"
```

The AI will recognize this matches the `k8s-pod-logs` template and execute it with the appropriate variables.

#### `commandTimeout` (optional)

Command execution timeout in milliseconds. Default: `30000` (30 seconds).

#### `maxConnections` (optional)

Maximum number of concurrent SSH connections. Default: `5`.

### Complete Example

See [config.example.json](config.example.json) for a complete configuration example.

## Available Tools

### `ssh_execute_command`

Execute commands on remote servers.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `command` (string, required): Command to execute
- `commandTimeout` (number, optional): Command execution timeout in milliseconds (overrides global `commandTimeout`)

**Example:**
```json
{
  "connectionName": "staging-api",
  "command": "docker ps -a"
}
```

**Response:**
```json
{
  "stdout": "CONTAINER ID   IMAGE     COMMAND   ...",
  "stderr": "",
  "exitCode": 0,
  "timedOut": false
}
```

### `ssh_port_forward`

Set up SSH port forwarding to access remote services.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `remoteHost` (string, required): Remote host to forward to
- `remotePort` (number, required): Remote port to forward to
- `localPort` (number, optional): Local port to bind to (random if omitted)

**Example with specific local port:**
```json
{
  "connectionName": "staging-db",
  "localPort": 8080,
  "remoteHost": "internal-db.cluster.local",
  "remotePort": 5432
}
```

**Example with automatic port assignment:**
```json
{
  "connectionName": "staging-db",
  "remoteHost": "internal-db.cluster.local",
  "remotePort": 5432
}
```

**Response:**
```json
{
  "localPort": 8080,
  "remoteHost": "internal-db.cluster.local",
  "remotePort": 5432,
  "status": "active"
}
```

### `ssh_close_port_forward`

Close an active port forward.

**Parameters:**
- `connectionName` (string, required): Name of the server
- `localPort` (number, required): Local port to close

**Example:**
```json
{
  "connectionName": "staging-db",
  "localPort": 8080
}
```

### `ssh_list_port_forwards`

List all active port forwards across all connections.

**Parameters:** None

**Response:**
```json
{
  "forwards": [
    {
      "connectionName": "staging-db",
      "localPort": 8080,
      "remoteHost": "internal-db.cluster.local",
      "remotePort": 5432
    }
  ]
}
```

### `ssh_port_forward_service`

Start a pre-configured named port forwarding service from your config.

**Parameters:**
- `serviceName` (string, required): Name of the service from `portForwardingServices` config

**Example:**
```json
{
  "serviceName": "pg-staging-database"
}
```

This is equivalent to calling `ssh_port_forward` with the pre-configured parameters.

### `ssh_upload_file`

Upload a file from local system to remote server via SFTP.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `localPath` (string, required): Local file path to upload
- `remotePath` (string, required): Remote destination path
- `permissions` (string, optional): File permissions in octal format (e.g., "0644", "0755")

**Example:**
```json
{
  "connectionName": "app-server",
  "localPath": "~/configs/app.json",
  "remotePath": "/var/www/app/config.json",
  "permissions": "0644"
}
```

**Response:**
```json
{
  "success": true,
  "bytesTransferred": 1024,
  "message": "Successfully uploaded ~/configs/app.json to /var/www/app/config.json",
  "localPath": "~/configs/app.json",
  "remotePath": "/var/www/app/config.json"
}
```

### `ssh_download_file`

Download a file from remote server to local system via SFTP.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `remotePath` (string, required): Remote file path to download
- `localPath` (string, required): Local destination path

**Example:**
```json
{
  "connectionName": "app-server",
  "remotePath": "/var/log/app/error.log",
  "localPath": "~/downloads/error.log"
}
```

**Response:**
```json
{
  "success": true,
  "bytesTransferred": 2048,
  "message": "Successfully downloaded /var/log/app/error.log to ~/downloads/error.log",
  "remotePath": "/var/log/app/error.log",
  "localPath": "~/downloads/error.log"
}
```

### `ssh_list_remote_files`

List files in a remote directory via SFTP.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `remotePath` (string, required): Remote directory path to list
- `pattern` (string, optional): Glob pattern to filter files (e.g., "*.log", "*.json")

**Example:**
```json
{
  "connectionName": "app-server",
  "remotePath": "/var/log/app",
  "pattern": ".*\\.log$"
}
```

**Response:**
```json
{
  "remotePath": "/var/log/app",
  "pattern": ".*\\.log$",
  "totalCount": 3,
  "files": [
    {
      "name": "error.log",
      "size": 10485760,
      "modified": "2024-12-04T12:00:00.000Z",
      "permissions": "100644",
      "isDirectory": false,
      "isFile": true
    }
  ]
}
```

### `ssh_delete_remote_file`

Delete a file on the remote server via SFTP.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `remotePath` (string, required): Remote file path to delete

**Example:**
```json
{
  "connectionName": "app-server",
  "remotePath": "/tmp/old-backup.tar.gz"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully deleted /tmp/old-backup.tar.gz",
  "remotePath": "/tmp/old-backup.tar.gz"
}
```

### `ssh_execute_template`

Execute a pre-configured command template with variable substitution.

**Parameters:**
- `connectionName` (string, required): Name of the server from your config
- `templateName` (string, required): Name of the command template
- `variables` (object, optional): Key-value pairs for variable substitution
- `commandTimeout` (number, optional): Command execution timeout in milliseconds (overrides global `commandTimeout`)

**Example:**
```json
{
  "connectionName": "kubernetes-bastion",
  "templateName": "k8s-pod-logs",
  "variables": {
    "namespace": "staging",
    "pod": "api-7d8f9",
    "lines": "50"
  }
}
```

**Response:**
```json
{
  "success": true,
  "templateName": "k8s-pod-logs",
  "expandedCommand": "kubectl logs -n production api-7d8f9 --tail=50",
  "variables": {
    "namespace": "staging",
    "pod": "api-7d8f9",
    "lines": "50"
  },
  "result": {
    "stdout": "...",
    "stderr": "",
    "exitCode": 0,
    "timedOut": false
  }
}
```

### `ssh_list_templates`

List all available command templates with their descriptions and variables.

**Parameters:** None

**Example:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "name": "k8s-pod-logs",
      "command": "kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}",
      "description": "Fetch Kubernetes pod logs with configurable tail size",
      "variables": [
        { "name": "namespace", "required": true },
        { "name": "pod", "required": true },
        { "name": "lines", "required": false, "defaultValue": "100" }
      ]
    }
  ],
  "count": 1
}
```

## Security

### Built-in Security Features

1. **Command Validation**
   - Automatically enabled when `allowedCommands` is specified
   - Validates all commands including pipes (`|`), chains (`&&`, `||`, `;`), and command substitutions (`$()`, backticks)
   - Blocks bypass attempts like `ls | rm -rf /` or `cat $(whoami)`
   - Uses robust parsing to prevent command injection

2. **Server Allowlist**
   - Only pre-configured servers in `ssh-mcp-config.json` can be accessed
   - No dynamic server connections allowed
   - Prevents unauthorized access to infrastructure

3. **SSH Key Authentication Only**
   - Only SSH key-based authentication is supported
   - No password authentication
   - Follows security best practices

4. **Connection Pooling**
   - Limits concurrent connections via `maxConnections`
   - Prevents resource exhaustion
   - Automatic cleanup of idle connections

5. **Template Validation**
   - Command templates are validated at config load time
   - Expanded template commands are subject to `allowedCommands` validation
   - Template syntax prevents conflicts with shell variable substitution
   - Docker/Go template patterns (`{{.Field}}`) are preserved and not substituted

### Security Considerations

⚠️ **Warning:** This server provides powerful capabilities. Consider the following:

- AI assistants will have the ability to execute commands and create tunnels on configured servers
- Ensure you understand the capabilities you're granting
- Start with restrictive `allowedCommands` and expand as needed
- Use separate SSH keys for MCP access
- Regularly audit command execution logs

## Examples

### Example 1: Kubernetes Management

**Config:**
```json
{
  "allowedCommands": ["kubectl", "helm", "docker"],
  "servers": {
    "k8s-bastion": {
      "host": "k8s-bastion.example.com",
      "username": "k8s-operator",
      "privateKeyPath": "~/.ssh/kubernetes_operator_key"
    }
  }
}
```

**Usage:**
Ask your AI assistant: "Check the status of pods in the staging namespace"

The assistant will execute:
```json
{
  "connectionName": "k8s-bastion",
  "command": "kubectl get pods -n staging"
}
```

### Example 2: Database Access via Port Forwarding

**Config:**
```json
{
  "servers": {
    "db-bastion": {
      "host": "bastion.example.com",
      "username": "dbadmin",
      "privateKeyPath": "~/.ssh/db_key"
    }
  },
  "portForwardingServices": {
    "staging-db": {
      "connectionName": "db-bastion",
      "localPort": 5432,
      "remoteHost": "db-internal.example.com",
      "remotePort": 5432,
      "description": "Staging PostgreSQL database"
    }
  }
}
```

**Usage:**
Ask your AI assistant: "Start the staging database tunnel"

The assistant will execute:
```json
{
  "serviceName": "staging-db"
}
```

Then you can connect locally: `psql -h localhost -p 5432 -U dbuser`

### Example 3: Docker Container Management

**Config:**
```json
{
  "allowedCommands": ["docker", "docker-compose"],
  "servers": {
    "app-server": {
      "host": "app-01.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/deploy_key"
    }
  }
}
```

**Usage:**
Ask your AI assistant: "Restart the nginx container on app-server"

The assistant will execute:
```json
{
  "connectionName": "app-server",
  "command": "docker restart nginx"
}
```

### Example 4: File Management and Log Analysis

**Config:**
```json
{
  "servers": {
    "app-server": {
      "host": "app-01.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/deploy_key"
    }
  }
}
```

**Usage:**

**Upload a configuration file:**
```
Ask your AI assistant: "Upload my local config.json to /var/www/app/config.json on app-server with 644 permissions"
```

The assistant will execute:
```json
{
  "connectionName": "app-server",
  "localPath": "~/config.json",
  "remotePath": "/var/www/app/config.json",
  "permissions": "0644"
}
```

**Download logs for analysis:**
```
Ask your AI assistant: "Download the error log from /var/log/app/error.log on app-server"
```

The assistant will execute:
```json
{
  "connectionName": "app-server",
  "remotePath": "/var/log/app/error.log",
  "localPath": "~/downloads/error.log"
}
```

**List and filter log files:**
```
Ask your AI assistant: "Show me all .log files in /var/log/app on app-server"
```

The assistant will execute:
```json
{
  "connectionName": "app-server",
  "remotePath": "/var/log/app",
  "pattern": ".*\\.log$"
}
```

**Clean up old backups:**
```
Ask your AI assistant: "Delete the old backup at /tmp/backup-2024-01-01.tar.gz on app-server"
```

The assistant will execute:
```json
{
  "connectionName": "app-server",
  "remotePath": "/tmp/backup-2024-01-01.tar.gz"
}
```

## License

Apache 2.0 - see [LICENSE](LICENSE) file for details.

---

**Repository:** [github.com/uarlouski/ssh-mcp-server](https://github.com/uarlouski/ssh-mcp-server)

**Issues:** [github.com/uarlouski/ssh-mcp-server/issues](https://github.com/uarlouski/ssh-mcp-server/issues)

**npm Package:** [@uarlouski/ssh-mcp-server](https://www.npmjs.com/package/@uarlouski/ssh-mcp-server)
