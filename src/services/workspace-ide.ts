import * as vscode from 'vscode';

export function getCurrentWorkspace(): vscode.WorkspaceFolder {
	if (!vscode.workspace.workspaceFolders) {
		const e = new Error('No folder opened yet. Please open some folder first by "File" -> "Open Folder...".');
		e.name = 'PopupError';
		throw e;
	}
	if (vscode.workspace.workspaceFolders.length > 1) {
		const e = new Error("More than one workspace' folder opened. Cannot decide, where to download app.");
		e.name = 'PopupError';
		throw e;
	}

	return vscode.workspace.workspaceFolders[0];
}
