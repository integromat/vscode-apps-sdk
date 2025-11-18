# VSCode library reimplementation for CLI environment - 'window' module

This directory is the reimplementation of VSCode 'window' module for CLI environment.

It means no `import * as vscode from 'vscode';` is possible here.
Only importing types is allowed, then the `import type * as IVscode from 'vscode';` is OK.

All implementation must to replace the native VSCode window module functionality into CLI friendly questions/errors/dialogs.
