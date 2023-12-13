import * as vscode from 'vscode';

/**
 * The version of the currently running VSCode Extension
 */
export const version: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.version;
