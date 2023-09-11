import * as vscode from 'vscode';
import { log } from './output-channel';
import { AxiosError } from 'axios';

/**
 * Displays an error message in the VSCode window.
 */
export function showError(err: Error | AxiosError<any> | string, title?: string | undefined) {
	// Case of dialog error
	if (err instanceof Error && err.name === 'PopupError') {
		vscode.window.showErrorMessage((title ?? '') + ' ERROR', { detail: err.message, modal: true });
		return;
	}

	let e: any = (err as AxiosError<any>).response?.data || err;
	// Axios can return JSON error message stringified, so try to parse them.
	try {
		e = JSON.parse(e);
	} catch (e) {
		/* ignore */
	}

	// Try to use APIError message format instead of syntax error
	if (e.message && e.detail) {
		let eText = `${e.message}. ${e.detail instanceof Array ? e.detail[0] : e.detail}`;
		if (e.suberrors instanceof Array) {
			eText += ' ' + e.suberrors.map((suberror: Error) => suberror.message).join(' ');
		}
		e = eText;
	}
	if (e.name && e.message) {
		e = `[${e.name}] ${e.message}`;
	}

	if (e instanceof Object || e instanceof Array) {
		e = JSON.stringify(e);
	}

	e = (title ? title + ': ' : '') + String(e);

	// Log Axios request URL
	if (err instanceof AxiosError) {
		e += ' Requested ' + err.request?.method + ' ' + err.request?.path;
	}

	// Show error message in VS Code
	vscode.window.showErrorMessage('ERROR: ' + e);

	// Log to VS Code console
	log('error', e, false);

	if (err instanceof Error) {
		log('error', `STACK: ${err.stack}`, false);
	}
}

/**
 * Function wrapper, which catches errors in async functions and displays them in the VSCode window.
 */
export function catchError<T extends (...args: any[]) => Promise<any>>(errorTitle: string, asyncFunc: T): T {
	return <T>(async (...args: any[]) => {
		try {
			return await asyncFunc(...args);
		} catch (err: any) {
			showError(err, errorTitle);
		}
	});
}

/**
 * Function wrapper, which displays a progress bar in the VSCode window during async function execution.
 * @deprecated Use 'vscode-progress-dialog.ts' -> `withProgressDialog() instead.
 */
// export function withProgress<T extends (...args: any[]) => Promise<any>>(
// 	options: Omit<vscode.ProgressOptions, 'location'|'cancellable'>,
// 	asyncFunc: T
// ): T {
// 	return <T>(async (...args: any[]) => {
// 		return await vscode.window.withProgress({
// 			location: vscode.ProgressLocation.Notification,
// 			cancellable: false,
// 			...options,
// 		}, async (progress, token) => {
// 			return await asyncFunc(...args);
// 		});
// 	});
// }
