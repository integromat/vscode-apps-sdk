import * as vscode from 'vscode';
import type { VsCodeLibWrapperCommandsInterface } from '../types';

function registerCommand(_command: string, _callback: (...args: any[]) => any): void {
	// forward request to the actual `vscode` implementation
	vscode.commands.registerCommand(_command, _callback);
}

async function executeCommand<T = unknown>(command: string, ...rest: any[]): Promise<T | undefined> {
	// forward request to the actual `vscode` implementation
	return vscode.commands.executeCommand<T>(command, ...rest);
}

export const vsCodeLibWrapperCommandsImplementationForIDE: VsCodeLibWrapperCommandsInterface = {
	registerCommand,
	executeCommand,
};
