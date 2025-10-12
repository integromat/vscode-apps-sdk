import type { Uri as UriType } from 'vscode';

const isCli = globalThis.environmentUI === 'cli';

export const Uri: UriType = isCli ? require('monaco-editor/esm/vs/base/common/uri') : require('vscode').Uri;

export type Uri = UriType;
