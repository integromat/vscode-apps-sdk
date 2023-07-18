import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined = undefined;

/**
 * Logs error into output console "Make Apps SDK extension".
 */
export function log(level: 'debug'|'info'|'warn'|'error', errorMessage: string, suppressFocusDebugConsole?: boolean) {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Make App SDK extension');
	}

	outputChannel.appendLine((new Date()).toLocaleString() + ` ${level.toUpperCase()}: ${errorMessage}`);

	if (level === 'error' && !suppressFocusDebugConsole) {
		outputChannel.show(true);
	}
}
