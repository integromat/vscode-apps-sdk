import { AsyncLocalStorage } from 'node:async_hooks';
import * as vscode from 'vscode';

const asyncLocalStorage = new AsyncLocalStorage<AsyncStorageWithProgress>();

/**
 * Displays the progress/busy dialog on top right of VSCode, until `asyncFunc` is finished.
 * During this time it is possible to use `progresDialogReport()` in any called function to update the dialog text details.
 */
export async function withProgressDialog<R>(
	options: Omit<vscode.ProgressOptions, 'location'>,
	asyncFunc: (
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		cancellationToken: vscode.CancellationToken,
	) => Promise<R>,
): Promise<R> {
	return await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			cancellable: false,
			...options,
		},
		async (progress, cancellationToken) => {
			return asyncLocalStorage.run({ progressDialog: { progress, cancellationToken } }, () => {
				return asyncFunc(progress, cancellationToken);
			});
		},
	);
}

/**
 * Updates the dialog text details displayed by `withProgressDialog()`.
 * Function can be called from any called function.
 *
 * Note: If no dialog is displayed, does not do anything.
 */
export function progresDialogReport(message: string) {
	const storage = asyncLocalStorage.getStore();
	(storage?.progressDialog as ProgressDialog)?.progress?.report({
		message,
	});
}

interface ProgressDialog {
	cancellationToken: vscode.CancellationToken;
	progress: vscode.Progress<{ message?: string; increment?: number }>;
}

interface AsyncStorageWithProgress {
	progressDialog: ProgressDialog;
}
