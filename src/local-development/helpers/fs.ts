import * as vscode from 'vscode';

export async function exists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true; // File exists
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
			return false; // File does not exist
		}
		// Handle other errors if necessary
		throw error;
	}
}
