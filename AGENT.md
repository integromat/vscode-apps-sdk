# AGENT.md - AI Coding Agent Instructions

This document provides comprehensive guidance for AI coding agents working on the Make Apps SDK VS Code Extension project.

## Project Overview

**Project Name:** Make Apps Editor for VS Code
**Type:** VS Code Extension
**Language:** TypeScript (with some JavaScript legacy files)
**Purpose:** Development and management tool for custom applications on the Make.com visual automation platform

### Key Features
- Online and offline source code editor with syntax highlighting for IML (Integromat Markup Language)
- Local Development for Apps (clone, edit, deploy workflow)
- App component management (modules, RPCs, connections, webhooks, IML functions)
- Icon editor and metadata management
- Version control integration
- Data structure generator (UDT)

## Technology Stack

### Core Technologies
- **TypeScript 5.5.4** - Primary language (strict mode enabled)
- **VS Code Extension API 1.95.1** - Extension framework (requires Node 20.18+)
- **Node.js 20.18+** - Runtime environment
- **vscode-languageclient/server** - Language server protocol implementation

## Code Conventions

### TypeScript Standards
1. **Strict Mode**: Always enabled - no implicit any, strict null checks
2. **File Extensions**:
   - `.ts` - TypeScript files (preferred)
   - `.js` - Legacy JavaScript files (being migrated)
3. **Module System**: ES Modules with `node16` module resolution

### Common Patterns

#### Error Handling
```typescript
import { catchError } from './error-handling';

// Wrap async command handlers
export async function someCommand() {
	return catchError(async () => {
		// Command implementation
	});
}
```

#### Logging
```typescript
import { log } from './output-channel';

log('debug', 'Debug message');
log('info', 'Info message');
log('error', 'Error message', error);
```

#### Configuration Access
```typescript
import { getConfiguration, getCurrentEnvironment } from './providers/configuration';

const config = getConfiguration();
const env = getCurrentEnvironment(config);
```


## Development Workflow

### Setup
```bash
npm ci                    # Install dependencies
npm run compile           # Build TypeScript
npm run watch             # Watch mode for development
```

### Testing
```bash
npm run test              # Run Mocha tests
npm run eslint            # Lint TypeScript files
```

### Debugging
Use `./debug.sh` or F5 in VS Code to launch Extension Development Host.

## Key Components Deep Dive

### 1. Extension Activation
**File**: `src/extension.ts`

- Activates on: `workspaceContains:**/makecomapp.json`
- Starts IMLJSON language server
- Registers all commands and providers
- Handles backward compatibility for config migration
- Sets up telemetry

### 2. Local Development of Make Apps
**Files**: `src/local-development/*`

- Is the key new feature for managing Make apps locally (similarly as clonning a Git repo)

## Final Notes for Agents

1. **Always run ESLint** before committing: `npm run eslint`
2. **Test compilation**: `npm run compile` must succeed
3. **Respect tabs**: This project uses tabs, not spaces
4. **Update schemas**: Run `npm run schema:makecomapp` after type changes
5. **Check package.json**: Commands, menus, settings must stay in sync
6. **Document user-facing changes** in README.md
7. **Use `catchError`** wrapper for all command handlers
