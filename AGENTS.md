# Make Apps Editor — VS Code Extension

VS Code extension for developing and managing Make.com custom apps: CRUD for modules, connections, RPCs, webhooks, and IML functions, plus a local-development workflow with deploy/pull/compare.

**Tech stack:** TypeScript, VS Code Extension API, axios, `@integromat/iml`, `@integromat/udt`, `vscode-json-languageservice`. Compiled to `out/`. Package manager: npm.

**Activation trigger:** `workspaceContains:**/makecomapp.json`

---

## Two Operating Modes

**Online mode** — edit remote apps live. Tree views (`AppsProvider`, `OpensourceProvider` in `src/providers/`) fetch from Make API. Opening a node downloads the file to a temp dir (`src/temp-dir.ts`). Saving uploads it back via `onWillSaveTextDocument` → `CoreCommands.sourceUpload()`. The temp file path literally mirrors the API URL path.

**Local development mode** — clone/pull app to workspace. All ops driven by `makecomapp.json` manifest. Source in `src/local-development/`.

---

## Extension Entry & Auth

`src/extension.ts` is the activation entry point. On each activation it reads `apps-sdk.environments[]` (array of env objects with `uuid`, `url`, `apikey`, `version`, optional `unsafe`/`noVersionPath`/`admin` flags) and `apps-sdk.environment` (selected UUID) from VS Code config (`src/providers/configuration.ts` — `getCurrentEnvironment()`).

Auth is `_authorization = 'Token ' + currentEnvironment.apikey`. Any auth change (login/logout/env switch) triggers a full window reload so `activate()` re-runs. If no valid apikey, extension enters limited mode and returns early.

`_environment.baseUrl` is assembled per version at `extension.ts:154–172`. For local-dev ops, each `makecomapp.json` origin carries its own `baseUrl` and `apikeyFile` — independent of the extension-level config.

---

## API Communication

All Make API calls go through `requestMakeApi()` in `src/utils/request-api-make.ts`. Key behaviors:
- Concurrency capped at 2 via `throat(2)`.
- `imt-apps-sdk-version` header injected on every call.
- HTTP 429: holds the throat slot for 5 s (throttling all queued calls), then re-enqueues via recursive retry — no max retry count.
- Returns `axiosResponse.data` only; callers never receive raw `AxiosResponse`.

`CoreCommands.ts:119` calls `axios()` directly (legacy online-mode upload — intentional bypass).

`Core.pathDeterminer(version, segment)` in `src/Core.ts` maps v1 singular paths to v2 plural paths (e.g. `app→apps`, `rpc→rpcs`, `__sdk→sdk/`). Used throughout tree-view command URL construction.

---

## Commands

`src/commands/` — one file per domain. Mix of legacy `.js` (CommonJS) and newer `.ts` (ES modules). All expose a static `register()` method. All async handlers wrapped in `catchError()` from `src/error-handling.ts`, which routes uncaught errors to `showAndLogError()`.

`CoreCommands.ts` is the only command class with instance state — it holds references to both providers to trigger tree refresh after mutations.

Local-dev commands registered via `registerCommandForLocalDevelopment()` in `src/local-development/index.ts`.

---

## Local Development Feature

Entry: `src/local-development/index.ts`. Core operations: `clone.ts`, `pull.ts`, `deploy.ts`, `compare-file.ts`.

**`makecomapp.json` schema** (`src/local-development/types/makecomapp.types.ts` — `MakecomappJson`):
- `origins[]` — each with `baseUrl`, `appId`, `appVersion`, `apikeyFile`, `idMapping`
- `idMapping` per component type: `{ local, remote, localDeleted?, nonOwnedByApp? }` — bridges developer-friendly local IDs to API-native remote names
- `components` — per type, per localId: metadata + `codeFiles` (relative paths)
- `generalCodeFiles` — app-level code (base, common, readme, groups)

The `makecomapp.schema.json` at `syntaxes/local-development/schemas/` is **auto-generated** at build time: `npm run schema:makecomapp`. Regenerate after changing `makecomapp.types.ts`.

**Component types:** `connection`, `webhook`, `module`, `rpc`, `function`. Versionable (URL includes `appVersion`): `module`, `rpc`. Non-versionable: `connection`, `webhook`, `function`.

**Checksum system:** before any PUT/PATCH, local MD5 is compared against `GET .../checksum` result. API call skipped if equal. Pull and deploy both start with `downloadOriginChecksums()`.

**`alignComponentsMapping()`** reconciles local vs remote component lists before every pull or deploy. During pull: new remote components → `askUser` or `cloneAsNew`. During deploy: new local components → `askUser`; new remote → `ignore`.

**Concurrency:** all `makecomapp.json` mutations serialized via `throat(1)` in `src/local-development/makecomappjson.ts`. Same pattern in `reserve-component-dir.ts`, `secrets-storage.ts`, `groups-json.ts`.

**File layout on disk:** `{root}/{componentType}s/{kebab-localId}/` — set at `reserve-component-dir.ts`.

---

## IML / IMLJSON Language Support

`syntaxes/iml/` — TextMate grammar for IML (`{{...}}` expressions). `syntaxes/imljson/` — JSON grammar with IML embedded inside string values. Schemas for all `.imljson` file variants in `syntaxes/imljson/schemas/`.

A forked VS Code JSON language server lives at `syntaxes/imljson-language-features/server/`. Launched at activation via `vscode-languageclient`; receives schema associations via `imljson/schemaAssociations` notification. Provides validation, completion, hover, formatting for `imljson` files. Document cache: 10 entries, 60 s TTL.

VS Code-side providers (registered/disposed per active file in `CoreCommands.keepProviders()`):
- `StaticImlProvider` — completions for all built-in IML functions from `IML.FUNCTIONS` (`@integromat/iml`)
- `ImlProvider` — completions for app-specific custom functions (fetched from API per file context)
- `ImljsonHoverProvider` — hover docs for IMLJSON keys and type values
- `ParametersProvider`, `DataProvider`, `RpcProvider` — context-specific completions

---

## IML Function Testing

`apps-sdk.function.test` → `executeCustomFunctionTest()` in `src/commands/FunctionCommands.ts`. Runs test code in a `node:vm` sandbox (`vm.createContext`). Sandbox exposes `iml.*` (all `IML.FUNCTIONS` bound with `{ timezone }`), all user custom functions, `assert`, and a minimal `it(name, fn)` runner. Per-step timeouts: 2000 / 1000 / 5000 ms.

---

## App Export / Import (ZIP)

Export (`AppCommands.js`): stages files into `tempy` dir, then `compressing.zip.compressDir()`. ZIP root has a `.sdk` marker (`{"version": 2}`).

Import: parses ZIP via `adm-zip`, builds a request queue (POST to create + PUT per code file), executes sequentially. Placeholder slugs (`#CONN_NAME#` etc.) replaced by POST response values.

---

## Build & Test

- `npm run compile` — `rm -rf ./out && tsc` (two tsconfigs: root + LSP server at `syntaxes/imljson-language-features/server`)
- `npm test` — compiles then runs `@vscode/test-electron` (downloads VS Code, runs Mocha inside it)
- Tests: `src/extension.test.ts` (integration), `src/commands/FunctionCommands.test.ts` (unit), `src/local-development/helpers/validate-id.test.ts` (unit)
- `__is-pre-release-build.ts` is generated by npm scripts — do not commit it; it is gitignored

---

## Key Non-Obvious Behaviors

- Online mode save failure: document re-dirtied via insert+delete so VS Code shows unsaved indicator.
- `CoreCommands.keepProviders()` fires on every active-editor change and re-registers up to 7 completion providers — dispose before re-register.
- Config migration in `extension.ts`: old object-format `apps-sdk.environments` auto-converted to array on activation.
- `Core.isVersionable()` determines whether a component URL includes `appVersion`.
- `nonOwnedByApp: true` in idMapping → skip metadata/code deploy entirely (cross-app connection/webhook references).

---

## When in Plan Mode
- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- Interview user in detail (for Claude: use the AskUserQuestionTool) about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. Be very in-depth and continue interviewing the user continually until it's complete. Use the answers to create a detailed spec.
- Make assumptions explicit: When you must proceed under uncertainty, list assumptions up front and continue.
