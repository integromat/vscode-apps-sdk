import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined = undefined;

export const extensionDisplayName: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.displayName;

export function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(extensionDisplayName + ' extension');
	}
	return outputChannel;
}

/**
 * Logs error into output console "Make Apps SDK extension".
 */
export function log(level: 'debug'|'info'|'warn'|'error', errorMessage: string) {
	const output = getOutputChannel();

	const rawLogLine = level.toUpperCase() + ': ' + errorMessage;

	// To display error in Github Action logs, send message to console as well.
	if (level === 'error') {
		console.log(extensionDisplayName + ' ' + rawLogLine);
	}

	output.appendLine((new Date()).toLocaleString() + ': ' + rawLogLine);
}

export function showLog() {
	const output = getOutputChannel();
	output.show(true);
}
