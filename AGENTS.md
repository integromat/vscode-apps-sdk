# AGENT.md - AI Coding Agent Instructions

This document provides comprehensive guidance for AI coding agents working on the Make Apps SDK VS Code Extension project.

## Project Overview

**Project Name:** Make Apps Editor for VS Code
**Type:** VS Code Extension, Command Line Interface (CLI)
**Language:** TypeScript (with some JavaScript legacy files)
**Purpose:** Development and management tool for Custom Applications (formerly named as SDK apps) on the Make.com visual automation platform

### VS Code Extension

#### Key Features

- Online and offline source code editor with syntax highlighting for IML (Integromat Markup Language)
- App component management (modules, RPCs, connections, webhooks, IML functions)
- Icon editor and metadata management
- Version control integration
- Data structure generator (UDT)
- Local Development for Apps (clone, edit, deploy workflow)
  - Note: The most of logclearic/libs/functions for local development is implemented in `/src/local-development` directory

#### Error Handling in all parts related to VS Code Extension

```typescript
import { catchError } from './error-handling';

// Wrap async command handlers
export async function someCommand() {
  return catchError(async () => {
    // Command implementation
  });
}
```

#### Logging in all parts related to VS Code Extension

```typescript
import { log } from './output-channel';

log('debug', 'Debug message');
log('info', 'Info message');
log('error', 'Error message', error);
```

### Setup

```bash
npm ci                    # Install dependencies
npm run compile           # Compile whole project from TypeScript to JavaScript
```

### Testing

```bash
npm run test              # Run Mocha tests (includes also npm run compile - no need to test compilation separately)
npm run eslint            # Lint TypeScript files
```

#### Key Components Deep Dive

##### 1. Extension Activation

**File**: `src/extension.ts`

- Activates on: `workspaceContains:**/makecomapp.json`
- Starts IMLJSON language server
- Registers all commands and providers
- Handles backward compatibility for config migration
- Sets up telemetry

##### 2. Local Development of Make Apps

**Files**: `src/local-development/*` works as the core library for local development features. They are share between VS Code Extension and CLI.

- Is the key new feature for managing Make apps locally (similarly as clonning a Git repo)

#### Final Notes for Agents (for VS Code Extension part)

1. **Always run ESLint** before committing: `npm run eslint`
2. **Test & compilation**: `npm run test` must succeed
3. **Respect tabs**: This project uses tabs, not spaces
4. **Update schemas**: Run `npm run schema:makecomapp` after type changes
5. **Check package.json**: Commands, menus, settings must stay in sync
6. **Use `catchError`** wrapper for all command handlers

### Command Line Interface

CLI client for local development.

The CLI wrapper is implemented in `src/cli`. See `AGENTS.md` in that directory for details.

It is the wrapper around already implemented functionality in the `/src/local-development` directory.
