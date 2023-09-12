import { AxiosError } from 'axios';
import * as vscode from 'vscode';
import { log } from './output-channel';

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
		let eText = `${improveErrorMessage(e.detail instanceof Array ? e.detail[0] : e.detail)}`;
		if (e.suberrors instanceof Array) {
			eText += ' ' + e.suberrors.map((suberror: Error) => improveErrorMessage(suberror.message)).join(' ');
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
		e +=
			' Technical details: Remote Make server rejected the request ' +
			(err.request?.method || '').toUpperCase() +
			' ' +
			err.request?.path;
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
 * Improves the specific error message to more user friendly one. In all other cases returns the original one.
 */
function improveErrorMessage(message: string): string {
	if (message === "Value doesn't match pattern in parameter 'name'.") {
		return 'Some local component has the invalid ID (name) defined. The ID must to follow specific restrictions for used letters, number and symbols.';
	}
	return message;
}
