import * as vscode from 'vscode';

export function getCurrentWorkspace(): vscode.WorkspaceFolder {
	if (!vscode.workspace.workspaceFolders) {
		throw new Error('No workspace opened');
	}
	if (vscode.workspace.workspaceFolders.length > 1) {
		throw new Error('More than one workspace opened. Cannot decide, where to download app.');
	}

	return vscode.workspace.workspaceFolders[0];
}
