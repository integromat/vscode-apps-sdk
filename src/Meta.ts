import * as vscode from 'vscode';

export const version: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.version;
