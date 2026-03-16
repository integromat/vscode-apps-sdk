# Make Apps Editor - VSCode Extension

VSCode extension for developing, managing, and deploying custom apps on the [Make](https://make.com) no-code integration platform.

Tech stack: Mix of JavaScript (older code) and TypeScript, VSCode Extension API, Axios for Make REST API communication.

## Project Purpose

Provides two modes of working with Make custom apps:

1. **Online Mode** - Direct CRUD operations on Make cloud apps via sidebar tree view. Commands in `src/commands/`, tree providers in `src/providers/`, API helpers in `src/Core.ts`.
2. **Local Development Mode** - Clone Make apps as local files, work offline with git versioning, deploy back. All code in `src/local-development/`.

## Architecture Overview

### Extension Activation

Entry point: `src/extension.ts`. Activates when workspace contains `makecomapp.json`. Registers commands, tree views, language features, and telemetry.

### API Communication

- `src/utils/request-api-make.ts` - Central HTTP client wrapping Axios. Rate-limits to 2 concurrent requests (via `throat`), auto-retries on 429. Adds extension version header.
- `src/Core.ts` - Higher-level API helpers (`rpGet`, `addEntity`, `editEntity`, `patchEntity`, `deleteEntity`). Supports both API v1 (legacy Integromat) and v2 (Make) via `pathDeterminer()`.
- Authentication:
  - **Online Mode**: API key is stored in VSCode settings as part of the configured Make environments and sent as `Authorization: Token <key>`.
  - **Local Development Mode**: API key is read from each origin’s `apikeyFile` defined in `makecomapp.json` (typically pointing to a `.secrets/...` file). The extension can prompt to create/update this secret file. The same `Authorization: Token <key>` header is used for requests.

Note: API v1 (legacy Integromat) is deprecated - do NOT implement new features using v1 endpoints. Use v2 endpoints exclusively.

### Error Handling

`src/error-handling.ts`:
- `errorToString()` - Extracts structured error info from AxiosError responses (detail, suberrors, message fields).
- `showAndLogError()` - Displays errors in VSCode UI + logs to output channel.
- `catchError()` - Wrapper used on all command registrations for consistent error handling.
- `improveSomeErrors()` - Maps known generic API errors to user-friendly messages.

### Multi-Environment Support

Users can configure multiple Make environments (different instances/regions). Config structure in `src/providers/configuration.ts`. Each environment has: URL, API key, API version (1 or 2), optional flags (unsafe, admin).

## Local Development for Apps

This is the most complex subsystem. It enables bidirectional sync between Make cloud apps and local filesystem.

### Core Concept

A Make app consists of **components** (connections, webhooks, modules, RPCs, functions) each containing **code files** (communication, parameters, interface, etc.). Local Development clones these into a filesystem structure managed by `makecomapp.json`.

### makecomapp.json - The Manifest

Central manifest file. Defines:
- `components` - Local component definitions keyed by local ID, with metadata (label, type, code file paths, references to other components)
- `origins` - One or more remote Make instances the app syncs with
- `origins[].idMapping` - Maps local component IDs to remote component names

Types defined in `src/local-development/types/makecomapp.types.ts` (interface `MakecomappJson`).

### Component ID Mapping System

Each component has a **local ID** (chosen by developer) and a **remote name** (assigned by Make API or matching local). The `idMapping` in each origin tracks these pairs:
- `{local: "myConn", remote: "myConn"}` - paired
- `{local: "myConn", remote: null}` - local only, not yet deployed
- `{local: null, remote: "oldConn"}` - remote only, ignored locally
- `{localDeleted: true, ...}` - marked for remote deletion. Purspose: allows tracking deleted components to remove them from Make on next deploy.
- `{nonOwnedByApp: true, ...}` - remote component that belongs to a different app version (typically connections/webhooks from another major version). No local code files are created; code deployment is skipped. These components are placed in `makecomapp.json` so they can be referenced by other components (e.g., a module referencing a non-owned connection).

Helper class: `src/local-development/helpers/component-id-mapping-helper.ts` (`ComponentIdMappingHelper`).

### Component Types and Dependencies

| Type | API name | Can reference |
|------|----------|--------------|
| connection | accounts | - |
| webhook | hooks | connection |
| module | modules | connection, altConnection, webhook |
| rpc | rpcs | connection |
| function | functions | - |

**Critical:** Components have cross-references. A module can reference a connection and webhook. These references use **local IDs** in `makecomapp.json` but must be translated to **remote names** when calling the API.

### Deploy Flow

`src/local-development/deploy.ts` (`bulkDeploy`):
1. Find affected codes via `findCodesByFilePath()`
2. Align mappings via `alignComponentsMapping()` - resolves unmapped components (ask user to deploy as new, map to existing, or ignore)
3. Deploy code files - MD5 checksum comparison skips unchanged files
4. Deploy metadata - PATCH component properties (label, type, connection references)

**Deploy ordering** (defined in `src/services/component-types-order.ts`): app(0) -> connection(1) -> rpc(2) -> webhook(3) -> module(4) -> function(5). This ensures dependencies exist before dependents.

### Creating Remote Components

`src/local-development/create-remote-component.ts`:
- Called during deploy when a local component has no remote counterpart
- POSTs to Make API to create component skeleton
- Must translate component reference IDs (e.g., module's connection reference) from local to remote names using `ComponentIdMappingHelper`
- Different component types require different API body shapes (`getApiBodyForComponentMetadataDeploy()` in `src/local-development/deploy-metadata.ts`)

### Pulling and Cloning

- `src/local-development/clone.ts` - Full app clone from Make to local workspace
- `src/local-development/pull.ts` - Pull specific or all components, updating local files and checksums
- `src/local-development/code-pull-deploy.ts` - Individual code file pull/deploy operations

### Checksums

Source of truth for change detection. API returns MD5 checksums per code file per component. Compared against local file hashes to skip unchanged deployments. Types in `src/local-development/types/checksum.types.ts`.

## Custom Languages

The extension provides syntax support for Make-specific formats:
- **IML** (Integromat Markup Language) - Template language injected into JSON strings. Grammar: `syntaxes/iml/`
- **IMLJSON** - JSON with embedded IML expressions. Grammar + schemas + snippets: `syntaxes/imljson/`
- **Language Server** - Full LSP implementation in `syntaxes/imljson-language-features/server/` providing validation, completion, hover, formatting against JSON schemas.

File types are validated against schemas in `syntaxes/imljson/schemas/` (parameters, api, common, base, scopes, etc.).

## Build and Test

- **Build:** `npm run compile` (runs `tsc` for both main extension and language server)
- **Test:** `npm run test` (compile + Mocha via `@vscode/test-electron`)
- **Test pattern:** `*.test.ts` files co-located with source. TDD-style (`suite`/`test`). Uses Node `assert`.
- **Lint:** `npm run eslint` (ESLint with TypeScript)
- **Schema generation:** `npm run schema:makecomapp` generates JSON schema from TypeScript types
- **Package:** `npm run vsceBuild` / `npm run vscePublish` (with pre-release flag mechanism)
- **CI:** GitHub Actions in `.github/workflows/ci.yaml` - runs tests on Ubuntu with xvfb

## Key Conventions

- Online-mode commands are in `src/commands/` as JS files with static `register()` methods. Local-dev commands are registered in `src/local-development/index.ts`.
- All async command handlers are wrapped with `catchError()` for consistent error display.
- Progress dialogs use `AsyncLocalStorage` pattern - see `src/utils/vscode-progress-dialog.ts`.
- Component code types map between user-friendly names and API names. Definitions in `src/services/component-code-def.ts`.
- File paths for local components follow: `{componentType}s/{localId}/{kebab-id}.{codeType}.{ext}`. Path logic in `src/local-development/local-file-paths.ts`.

## Known Gotchas

- API uses different names for component types than the extension: `accounts` (not connections), `hooks` (not webhooks).
- Checksum API returns component types under these API names, not local names.
- When creating remote components during deploy, all referenced components (connections, webhooks) must already exist in remote. The deploy ordering handles this, but the ID translation from local to remote must be correct.
- Some components may be "non-owned" - belonging to a different app version. In checksums they have `external: true`, in idMapping they have `nonOwnedByApp: true`. Applies only to connections and webhooks. Their code is not deployed and no local files are created, but they can be referenced by other components.

## When in Plan Mode
- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Interview user in detail (for Claude: use the AskUserQuestionTool) about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing the user continually until it's complete. Use the answers to create a detailed spec.
- Make assumptions explicit: When you must proceed under uncertainty, list assumptions up front and continue.
