import type { VsCodeLibWrapperCommandsInterface } from '../types';

function registerCommand(_command: string, _callback: (...args: any[]) => any): void {
	// No implementation needed in CLI mode.
}

function executeCommand<T = unknown>(command: string, ...rest: any[]): Promise<T | undefined> {
	console.log('Ignored call to vscode.commands.executeCommand in CLI mode. Command:', command, 'Args:', rest);
	return Promise.resolve(undefined);
}

export const vsCodeLibWrapperCommandsImplementationForCLI: VsCodeLibWrapperCommandsInterface = {
	registerCommand,
	executeCommand,
};
