import * as vscode from 'vscode';

/**
 * Current running VSCode Extension version
 */
export const version: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.version;
