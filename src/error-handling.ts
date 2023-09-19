import { AxiosError } from 'axios';
import * as vscode from 'vscode';
import { log, showLog } from './output-channel';

/**
 * Displays an error message in the VSCode toast notification / modal / console log
 */
export function showError(err: Error | AxiosError<any> | string, actionTitle?: string | undefined) {
	const errMessages: string[] = [];

	// Case of the Modal Popup
	if (err instanceof Error && err.name === 'PopupError') {
		vscode.window.showErrorMessage('Failed ' + (actionTitle ?? ''), { detail: err.message, modal: true });
		return;
	}

	// #region Case of the Error toast notification
	else if (err instanceof AxiosError) {
		// Try to use APIError message format instead of syntax error
		if (err.response?.data.message && err.response?.data.detail) {
			// let originalMessage: string = `${err.response.data.detail instanceof Array ? err.response.data.detail[0] : err.response.data.detail}`;
			// let improvedMessage: string | undefined = getImprovedErrorMessage(originalMessage);
			if (err.response.data.suberrors instanceof Array && err.response.data.suberrors.length > 0) {
				errMessages.push(
					...(err.response.data.suberrors as { message: string }[]).map((suberror) => suberror.message),
				);
			} else {
				// No suberrors exist
				const detailMessage = `${
					err.response.data.detail instanceof Array ? err.response.data.detail[0] : err.response.data.detail
				}`;
				errMessages.push(detailMessage);
			}
		} else if (typeof err.response?.data === 'string') {
			// Axios can return JSON error message stringified, so try to parse them.
			errMessages.push(String(err.response.data));
		} else {
			errMessages.push(err.response?.status + ' ' + (err.response?.statusText ?? 'Unknown response error'));
		}
	} else if (err instanceof Error && err.name && err.message) {
		errMessages.push(`[${err.name}] ${err.message}`);
	} else if (err instanceof Object) {
		errMessages.push(JSON.stringify(err));
	} else {
		errMessages.push(String(err));
	}

	const improved = improveSomeErrors(errMessages);
	const errMessage = improved.messages.join(' - ');

	// Show error message in VS Code
	vscode.window
		.showErrorMessage(
			(actionTitle ? `FAILED ${actionTitle.toLocaleUpperCase()}: ` : '') + errMessage,
			'OK',
			'Show error log',
		)
		.then((userResponse) => {
			if (userResponse === 'Show error log') {
				showLog();
			}
		});

	// #endregion Case of the Error toast notification

	// Log to console
	if (err instanceof AxiosError) {
		// Log Request CRUD + path
		log(
			'error',
			'Rejected the Make request ' +
				(err.request?.method || '').toUpperCase() +
				' ' +
				err.request?.path +
				(err.response?.data instanceof Object ? '\n\t' + JSON.stringify(err.response?.data) : '') +
				(typeof err.response?.data === 'string' ? '\n\t' + err.response?.data : ''),
		);
	} else if (err instanceof Error && !improved.improved) {
		// Log to VS Code console
		log('error', errMessage);
		if (!improved.improved) {
			log('error', `\tSTACK: ${err.stack}`);
		}
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
 * Improves the specific error message to more user friendly one. In all other cases returns undefined.
 */
function getImprovedErrorMessage(message: string): string | undefined {
	if (message === "Value doesn't match pattern in parameter 'name'.") {
		return 'Some local component has the invalid ID (name) defined. The ID must to follow specific restrictions for used letters, number and symbols.';
	}
	if (message.startsWith('Invalid symbol in JSONC at position')) {
		return 'JSON has corrupted structure. Code cannot be deployed. Find and fix the error and try to deploy again.';
	}
	return undefined;
}

/**
 * Process the list of error messages and when some is generic known message, replaces it by more user friendly one.
 * Note: User friendly messages are prioritized, so moved to the top of the list.
 */
function improveSomeErrors(messages: string[]): { messages: string[]; improved: boolean } {
	const improvedMessages = messages
		.map(getImprovedErrorMessage)
		.filter((message) => message !== undefined) as string[];
	const otherMessages = messages.filter((message) => !getImprovedErrorMessage(message));
	return {
		improved: improvedMessages.length > 0,
		messages: [
			// Prioritize the messages with "improved" text
			...improvedMessages,
			// Then display others (with the original text)
			...otherMessages,
		],
	};
}
