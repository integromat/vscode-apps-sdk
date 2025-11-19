import type * as IVscode from 'vscode';
import { getCurrentCliContext } from '../cli/cli-context';
import { Uri } from './vscode-lib-wraper/vscode-cli-modules/uri';

/**
 * @returns The current workspace folder object.
 * In CLI mode, the workspace is the directory provided by CLI option `--local-dir <filesystem-path>`.
 */

export function getCurrentWorkspace(): IVscode.WorkspaceFolder {
	const pathFromCliArgument = getCurrentCliContext().options.localDir as string | undefined;
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
