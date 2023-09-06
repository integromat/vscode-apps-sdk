import * as vscode from 'vscode';

export function getCurrentWorkspace(): vscode.WorkspaceFolder {
	if (!vscode.workspace.workspaceFolders) {
		const e = new Error('No workspace opened yet. Please open the workspace first by "File" -> "Open folder".');
		e.name = 'PopupError';
		throw e;
	}
	if (vscode.workspace.workspaceFolders.length > 1) {
		const e = new Error('More than one workspace opened. Cannot decide, where to download app.');
		e.name = 'PopupError';
		throw e;
	}

	return vscode.workspace.workspaceFolders[0];
}
