import * as vscode from 'vscode';
import * as vsCodeCliMock from './vscode-cli-mock';

declare global {
	var environmentUI: 'vscode' | 'cli';
}

export let finalLibrary: typeof vscode;

switch (globalThis.environmentUI) {
	case 'vscode':
		// This variant is used when running in the VSCode environment
		finalLibrary = vscode;
		break;

	case 'cli':
		// This variant is used when running in the CLI environment as part of '/src/cli/**'
		finalLibrary = vsCodeCliMock.cliModificationOfVscodeLib;
		break;

	default:
		throw new Error(`Unsupported environment: ${global.environmentUI}`);
}
