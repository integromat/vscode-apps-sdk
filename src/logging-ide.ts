import * as vscode from 'vscode';

/**
 * @module
 * provides the ability to write logs to VS Code output console named as `Make Apps SDK extension`.
 */

/**
 * Storage for output console `Make Apps SDK extension` singleton.
 */
let outputChannel: vscode.OutputChannel | undefined = undefined;

const extensionDisplayName: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.displayName;

/**
 * Gets the output console `Make Apps SDK extension`.
 * It is a singleton.
 */
function getOutputChannel(): vscode.OutputChannel {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel(extensionDisplayName + ' extension');
	}
	return outputChannel;
}

/**
 * Logs error into output console `Make Apps SDK extension`.
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', errorMessage: string) {
	const output = getOutputChannel();

	const rawLogLine = level.toUpperCase() + ': ' + errorMessage;

	// To display error in Github Action logs, send message to console as well.
	if (level === 'error') {
		console.log(extensionDisplayName + ' ' + rawLogLine);
	}

	output.appendLine(new Date().toLocaleString() + ': ' + rawLogLine);
}

/**
 * Switches the VS Code's bottom tab to `Output` -> `Make Apps SDK extension` for displaying the log messages to developer.
 */
export function showLog() {
	const output = getOutputChannel();
	output.show(true);
}
