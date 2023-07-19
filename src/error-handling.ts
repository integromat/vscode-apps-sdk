
import * as vscode from 'vscode';
import { log } from './output-channel';
import { AxiosError } from 'axios';

/**
 * Displays an error message in the VSCode window.
 */
export function showError(err: Error | AxiosError<any> | string, title?: string|undefined) {

	let e: any = (err as AxiosError<any>).response?.data || err;
	// Axios can return JSON error message stringified, so try to parse them.
	try {
		e = JSON.parse(e);
	} catch(e) { /* ignore */ }

	// Try to use APIError message format instead of syntax error
	if (e.message && e.detail) {
		e = `${e.message}. ${e.detail instanceof Array ? e.detail[0] : e.detail}`;
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
}


/**
 * Function wrapper, which catches errors in async functions and displays them in the VSCode window.
 */
export function catchError<T extends (...args: any[]) => Promise<any>>(
	errorTitle: string,
	asyncFunc: T
): T {
	return <T>(async (...args:any[]) => {
		try {
			return await asyncFunc(...args);
		} catch (err: any) {
			showError(err, errorTitle);
		}
	});
  }
