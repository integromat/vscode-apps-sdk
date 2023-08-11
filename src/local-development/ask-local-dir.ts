import * as vscode from 'vscode';
import { getCurrentWorkspace } from '../services/workspace';

/**
 * Opens vs code directory selector and returns the selected directory.
 * Returns undefined, when user cancels the dialog.
 */
export async function askForAppDirToClone(): Promise<vscode.Uri | undefined> {
	const workspace = getCurrentWorkspace();
	const directory = await vscode.window.showInputBox({
		ignoreFocusOut: true,
		prompt: 'Enter the current workspace subdirectory, where the app will be cloned to.',
		value: 'src',
		title: 'Destination, where to clone the app',
	});
	if (!directory) {
		return undefined;
	}
	return vscode.Uri.joinPath(workspace.uri, directory);
}
