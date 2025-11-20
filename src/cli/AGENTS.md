# CLI Directory - AI Agent Instructions

This directory provides command-line interface functions for local development of Make.com Custom Applications.

## Purpose

The CLI enables developers to work with Make Custom Apps locally by:

- **Pulling** apps from Make.com to local disk as files
- **Deploying** local changes back to Make.com

## Key Functionality

- Download app components (modules, connections, webhooks, RPCs, functions) to local file structure
- Push local code changes to Make.com platform
- Synchronize between local development environment and Make.com cloud

This allows developers to use their preferred local development tools and workflows while building Make Custom Applications.

## Architecture

### `index.ts`

Main entry point for CLI commands related to AI Agents. Handles command parsing and execution.
It is the wrapper around already implemented functionality in the `/src/local-development` directory,

### Reimplementation of `vscode` library for CLI

The implementation in `/src/local-development` uses and was designed for `vscode` library SDK.
But for usage in CLI, the `vscode` library cannot be used directly. Therefore, it is wrapped in `/src/services/vscode-lib-wrapper`.
This wrap automatically detects the environment (CLI or VSCode) and uses the appropriate implementation.

- For VSCode environment, it uses the original `vscode` library.
- For CLI environment, it uses own implementation customized for CLI environment (like native NodeJS file system access, CLI user inputs, etc).

## Building and Running

To test that the typescript builds correctly, run from the workspace root:

```bash
## dry build to test Typescript compilation
npm run cli:build

## run the CLI (initial help should appear, includes build step)
npm run cli:start

## run specific command:

### Example: clone an app "fake-app-id" from cloud "eu1.make.com" into local folder "./temp"
npm run cli:start -- clone fake-app-id --make-host eu1.make.com --local-dir ./temp
```
