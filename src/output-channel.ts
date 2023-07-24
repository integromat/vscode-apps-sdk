import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined = undefined;

export const extensionDisplayName: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.displayName;

/**
 * Logs error into output console "Make Apps SDK extension".
 */
export function log(level: 'debug'|'info'|'warn'|'error', errorMessage: string, suppressFocusDebugConsole?: boolean) {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(extensionDisplayName + ' extension');
	}

	const rawLogLine = level.toUpperCase() + ': ' + errorMessage;

	// Because of Mocha tests, send the log to console as well.
	console.log(extensionDisplayName + ' ' + rawLogLine);

	outputChannel.appendLine((new Date()).toLocaleString() + ': ' + rawLogLine);

	if (level === 'error' && !suppressFocusDebugConsole) {
		outputChannel.show(true);
	}
}
