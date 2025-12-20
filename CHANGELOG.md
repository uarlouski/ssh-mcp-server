# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Import SSH server configurations from existing SSH config files
- Command execution timeout support
  - Global `commandTimeout` configuration option (milliseconds)
  - Per-request `commandTimeout` parameter for `ssh_execute_command` and `ssh_execute_template` (overrides global)
- Server Discovery Tool:
  - `ssh_list_servers` tool to list all available SSH servers configured in the config file

### Removed
- Remove unused global `timeout` configuration option

## [1.3.0] - 2024-12-08

### Added
- Command Template Tools:
  - `ssh_execute_template` tool to execute pre-configured command templates with variable substitution
  - `ssh_list_templates` tool to list all available templates with their descriptions and required variables

## [1.2.0] - 2024-12-06

### Added
- SFTP Tools:
  - `ssh_upload_file` tool to upload files from local to remote servers with optional permission setting
  - `ssh_download_file` tool to download files from remote servers to local system
  - `ssh_list_remote_files` tool to list files in remote directories with glob pattern filtering
  - `ssh_delete_remote_file` tool to delete files on remote servers

### Changed
- Change default config filename to avoid conflicts with other tools

### Deprecated
- Deprecate default config filename `config.json` use `ssh-mcp-config.json` instead

## [1.1.0] - 2025-12-03

### Added
- Dynamic port allocation for `ssh_port_forward` tool (optional `localPort`)
- Connect to named port forwarding services via `ssh_port_forward_service` tool

## [1.0.0] - 2025-12-02

### Added
- Persistent SSH sessions with connection reuse across multiple commands
- SSH key-based authentication
- Tools:
  - `ssh_execute_command` tool for executing shell commands on remote servers with stdout/stderr capture
  - `ssh_port_forward` tool to set up local port forwarding tunnels (local → remote host:port)
  - `ssh_close_port_forward` tool to close active port forwarding tunnels
  - `ssh_list_port_forwards` tool to list all active forwarding tunnels with connection details
- Configurable command allowlist-based filtering with strict and disabled modes

### Security
- Only SSH key authentication supported (no password authentication)
- Server whitelist - only pre-configured servers in `config.json` are accessible
- Command validation with strict mode enabled by default when `allowedCommands` is specified
