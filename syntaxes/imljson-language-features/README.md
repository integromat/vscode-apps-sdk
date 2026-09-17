Origin of this directory `imljson-language-features`
====================================================

This directory contains the server part of `json-language-features` library
copied from https://github.com/microsoft/vscode/tree/main/extensions/json-language-features/server

The current version is from commit https://github.com/microsoft/vscode/tree/6d278df19ec7f778d75dc5ad239ad391325836e2/extensions/json-language-features/server .

**Why this commit and not `main`:** `6d278df19` is the parent of Microsoft's ESM migration
(`91b02efb2`, "use ESM for HTML/CSS/JSON language servers"). In that single commit upstream switched
the server to `"type": "module"` *and* to `vscode-json-languageservice` `^6.0.0-next.1`. Version 6 of
that library has no stable release at all (its npm `latest` tag still points at a `-next` build), and
our extension is CommonJS. So `main` cannot be adopted without an ESM migration plus a prerelease
major of the JSON schema engine that all IMLJSON validation depends on. `6d278df19` is the newest
upstream state whose dependency requirements our root `package.json` already satisfies. [written on 2024-09-17, can be outdated in the future]

File `jsonServer.ts` has minor updates against original
-------------------------------------------------------

- 'json/schemaAssociations' => 'imljson/schemaAssociations'

- 'json/schemaContent' => 'imljson/schemaContent'

- 'json/validate' => 'imljson/validate'

- 'json/languageStatus' => 'imljson/languageStatus'

- 'json/validateAll' => 'imljson/validateAll'

- 'json/validateContent' => 'imljson/validateContent'

- 'json/sort' => 'imljson/sort'

- `const documentSelector = [{ language: 'json' }, { language: 'jsonc' }];` => `const documentSelector = [{ language: 'imljson' }, { language: 'imljsonc' }];`
  - Note: Language `imljsonc` not used in the extension, but kept here as simplification

- In `validateTextDocument()`, the `documentSettings` language check tests for both IMLJSON languages
  instead of only `jsonc`, via an added `isImljson` local:
  `const isImljson = textDocument.languageId === 'imljson' || textDocument.languageId === 'imljsonc';`
  used in the `comments` and `trailingCommas` fallbacks.
  - Used for allow comments in all IMLJSON files
  - Note: upstream reworked this into severity overrides (`commentsSeverity ?? ...`); the deviation is
    adapted to that shape rather than replacing the whole statement as before.

- `languageModelCache.ts` imports `TextDocument` from `vscode-json-languageservice` instead of
  `vscode-languageserver`.
  - `vscode-languageserver` re-exports the legacy `TextDocument` from `vscode-languageserver-types`,
    which lacks members (`getLineRange`, `getEOLCharacters`) that
    `vscode-languageserver-textdocument` has, so the two are no longer assignable to each other.
  - The inconsistency can only be resolved in this direction -- importing `TextDocument` from
    `vscode-languageserver` everywhere instead does not compile (tried: 32 errors), because:
    1. `vscode-languageserver` does not re-export the `vscode-languageserver-textdocument` type at
       all, so the compatible `TextDocument` is simply not reachable from there.
    2. `new TextDocuments(TextDocument)` in `jsonServer.ts` needs a `TextDocumentsConfiguration`,
       i.e. `{ create, update }`. The `vscode-languageserver-types` namespace only provides
       `create`/`is`/`applyEdits` -- it has no `update` -- so the construction fails and TypeScript
       degrades the type to `TextDocuments<{ uri: string }>`, which then breaks ~15 call sites.
    3. `languageService.parseJSONDocument()` and `doValidation()` require the
       `vscode-languageserver-textdocument` type regardless, so those call sites would keep failing
       with the original error anyway.
  - Rationale: `vscode-languageserver-types` is a protocol-level data-type library, while
    `vscode-json-languageservice` is the library that actually consumes the documents and re-exports
    the implementation type. After this change `jsonServer.ts`, `languageModelCache.ts` and
    `utils/validation.ts` all agree on one source.
  - Upstream `main` has since made this exact same change, so a future re-vendor will absorb it.

- `sortCodeActionKind` is left as upstream's `source.sort.json` (not renamed), because nothing on the
  client side references it.

Dependencies
------------

Files have dependencies, see `package.original.json` (a verbatim copy of upstream's own manifest at
the commit above -- it is not read by any tooling, it only records what upstream declared). When
dependencies `vscode-languageclient`, `vscode-languageserver` are updated in the root `package.json`,
then files in this directory should be also updated from origin (Microsoft GitHub) to version match.

Note that these files compile against the **root** `node_modules` -- this directory has no
`node_modules` of its own and its `tsconfig.json` sets no `paths`/`baseUrl`. Every dependency listed
in `package.original.json` must therefore be declared in the root `package.json`, not merely present
transitively, or an unrelated dependency bump can silently change or remove it.
