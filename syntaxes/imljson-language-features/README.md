Origin of this directory `imljson-language-features`
====================================================

This directory contains the server part of `json-language-features` library
copied from https://github.com/microsoft/vscode/tree/main/extensions/json-language-features/server

The current version if from commit https://github.com/microsoft/vscode/tree/1d7b8b8a43a2272d03ad007b5d61c368d399946a , which was the "main" branch in the time of copiing.

File `jsonServer.ts` has minor updates against original
-------------------------------------------------------

- 'json/schemaAssociations' => 'imljson/schemaAssociations'

- 'json/schemaContent' => 'imljson/schemaContent'

- 'json/validate' => 'imljson/validate'

- 'json/languageStatus' => 'imljson/languageStatus'

- `const documentSelector = [{ language: 'json' }, { language: 'jsonc' }];` => `const documentSelector = [{ language: 'imljson' }, { language: 'imljsonc' }];`
  - Note: Language `imljsonc` not used in the extension, but kept here as simplification

- `const documentSettings: DocumentLanguageSettings = textDocument.languageId === 'imljsonc' ? { comments: 'ignore', trailingCommas: 'warning' } : { comments: 'error', trailingCommas: 'error' };` => `const documentSettings: DocumentLanguageSettings = (textDocument.languageId === 'imljson' || textDocument.languageId === 'imljsonc') ? { comments: 'ignore', trailingCommas: 'warning' } : { comments: 'error', trailingCommas: 'error' };`
  - Used for allow comments in all IMLJSON files

Dependencies
------------

Files have dependencies, see `package.original.json`. When dependencies `vscode-languageclient`, `vscode-languageserver` are updated in the root `package.json`, then files in this directory should be also updated from origin (Microsoft GitGub) to version match.
