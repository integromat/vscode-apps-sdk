import type * as IVscode from 'vscode';
import { getCurrentCliContext } from '../cli/cli-context';
import { Uri } from './vscode-lib-wraper/vscode-cli-modules/uri';

export function getCurrentWorkspace(): IVscode.WorkspaceFolder {
	const pathFromCliArgument = getCurrentCliContext().arguments.directory as string;
	if (!pathFromCliArgument) {
		throw new Error('No directory provided in CLI arguments.');
	}

	// Generate a workspace folder object from the directory path placed by CLI argument.
	const workspaceFolder: IVscode.WorkspaceFolder = {
		uri: Uri.file(pathFromCliArgument),
		name: pathFromCliArgument, // Not useful
		index: 0, // Not useful
	};

	return workspaceFolder;
}
