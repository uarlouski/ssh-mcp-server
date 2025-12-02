# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-02

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
