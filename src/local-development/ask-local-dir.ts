import * as vscode from 'vscode';
import { getCurrentWorkspace } from '../services/workspace';

/**
 * Opens vs code directory selector and returns the selected directory.
 * Returns undefined, when user cancels the dialog.
 */
export async function askForAppDirToClone(): Promise<vscode.Uri | undefined> {
	const workspace = getCurrentWorkspace();

	// Ask user for the destination directory.
	const directory = await vscode.window.showInputBox({
		ignoreFocusOut: true,
		prompt: 'Enter the current workspace subdirectory, where the app will be cloned to.',
		value: 'src',
		title: 'Destination, where to clone the app',
	});
	if (directory === undefined) {
		return undefined;
	}

	// Warning if clone planned to be into rootdir
	if (['', '/', '\\'].includes(directory)) {
		const confirmAnswer = await vscode.window.showWarningMessage(
			'Clone the app into project root',
			{
				modal: true,
				detail:
					'You are planning to clone the app into open folder root. ' +
					'It means you will not be able to clone multiple apps into same project. ' +
					'If you are OK with this limitation, you can continue.',
			},
			{ title: 'Continue' },
		);
		if (confirmAnswer?.title !== 'Continue') {
			return;
		}
	}

	// Warning if directory contains some data
	const destinationDir = vscode.Uri.joinPath(workspace.uri, directory);
	try {
		const directoryContent = await vscode.workspace.fs.readDirectory(destinationDir);
		if (directoryContent.length > 0) {
			const confirmAnswer = await vscode.window.showWarningMessage(
				'Directory already exists',
				{
					modal: true,
					detail: `Directory "${directory}" you have selected is already exists and is NOT EMPTY. It is strongly recommended to clone app into empty or not existing directories only. Are you sure you still want to clone app into this folder?`,
				},
				{ title: 'Continue' },
			);
			if (confirmAnswer?.title !== 'Continue') {
				return;
			}
		}
	} catch (e: any) {
		if (!e.name.includes('NotFound')) {
			e.message = `Unknown error during directory "${directory}" checkup. ${e.message}`;
			throw e;
		}
	}

	return destinationDir;
}
