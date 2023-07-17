
import * as vscode from 'vscode';
import { log } from './output-channel';
import { AxiosError } from 'axios';

/**
 * Displays an error message in the VSCode window.
 */
export function showError(err: Error | AxiosError<any> | string, title: string|undefined) {

	let e: any = (err as AxiosError<any>).response?.data || err;

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

	// Show error message in VS Code
	vscode.window.showErrorMessage(e);

	// Log to VS Code console
	log('error', e, false);
}
