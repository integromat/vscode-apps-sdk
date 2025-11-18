import { AsyncLocalStorage } from 'node:async_hooks';
import type * as IVscode from 'vscode';

const asyncLocalStorage = new AsyncLocalStorage<AsyncStorageWithProgress>();

/**
 * Displays the progress/busy dialog on top right of VSCode, until `asyncFunc` is finished.
 * During this time it is possible to use `progresDialogReport()` in any called function to update the dialog text details.
 */
export async function withProgressDialog<R>(
	options: Omit<IVscode.ProgressOptions, 'location'>,
	asyncFunc: (
		progress: IVscode.Progress<{ message?: string; increment?: number }>,
		cancellationToken: IVscode.CancellationToken,
	) => Promise<R>,
): Promise<R> {
	if (options.title) {
		console.log(`${options.title}: Started`);
	}
	return await asyncLocalStorage.run({ progressTitle: options.title }, async () => {
		const ret = await asyncFunc(cliProgress, dummyCancellationToken);
		if (options.title) {
			console.log(`${options.title}: Finished`);
		}
		return ret;
	});
}

/**
 * logs the text details under `withProgressDialog()`.
 * Function can be called from any called function.
 *
 * Note: If no dialog is displayed, does not do anything.
 */
export function progresDialogReport(message: string) {
	const storage = asyncLocalStorage.getStore();
	const dialogTitle = storage?.progressTitle;
	console.log(`${dialogTitle ? dialogTitle + ': ' : ''}${message}`);
}

const dummyCancellationToken: IVscode.CancellationToken = {
	isCancellationRequested: false,
	onCancellationRequested: () => {
		return {
			dispose: () => {
				/* ingnore */
			},
		};
	},
};

/**
 * CLI version of VSCode Progress percentage update.
 */
const cliProgress: IVscode.Progress<{ message?: string; increment?: number }> = {
	report: (value: { message?: string; increment?: number }) => {
		const storage = asyncLocalStorage.getStore();
		const dialogTitle = storage?.progressTitle;
		console.log(`${dialogTitle ? dialogTitle + ': ' : ''}${value.message || ''}`);
	},
};

interface AsyncStorageWithProgress {
	progressTitle: string | undefined;
}
