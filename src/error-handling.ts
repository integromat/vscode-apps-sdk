import { AxiosError } from 'axios';
import * as vscode from 'vscode';
import { log, showLog } from './output-channel';

/**
 * Smart convert a varios types of errors to string.
 */
export function errorToString(err: Error | AxiosError<any> | string): { message: string; isImproved: boolean } {
	try {
		const errMessages: string[] = [];

		if (typeof err === 'string') {
			errMessages.push(err);
		}

		// #region Case of the Error toast notification
		else if (err instanceof AxiosError) {
			// Use error `detail` + `suberrors`, which are used by Make API as part of error responses.
			const hasSuberrors =
				err.response?.data?.suberrors instanceof Array && err.response.data.suberrors.length > 0;
			if (err.response?.data?.detail || hasSuberrors) {
				if (err.response?.data?.detail) {
					const detailMessages: string[] =
						err.response.data.detail instanceof Array
							? err.response.data.detail
							: [err.response.data.detail];
					errMessages.push(...detailMessages.map((m) => String(m)));
				}
				if (hasSuberrors) {
					errMessages.push(
						...(err.response!.data.suberrors as { message: string }[]).map((suberror) => suberror.message),
					);
				}
			} else if (err.response?.data.message) {
				errMessages.push(err.response.data.message);
			} else if (typeof err.response?.data === 'string') {
				// Axios can return JSON error message stringified, so try to parse them.
				errMessages.push(String(err.response.data));
			} else {
				errMessages.push(err.response?.status + ' ' + (err.response?.statusText ?? 'Unknown response error'));
			}
		} else if (err instanceof Error && err.message) {
			errMessages.push(err.message);
		} else if (err instanceof Object) {
			errMessages.push(JSON.stringify(err));
		} else {
			errMessages.push(String(err));
		}

		const improved = improveSomeErrors(errMessages);

		return {
			message: improved.messages.join(' - '),
			isImproved: improved.isImproved,
		};
	} catch (e: any) {
		/*
		 * To avoid an infinit loop in case of internal error,
		 * it is needed to handle exception and have the stupid solution as fallback.
		 *
		 */
		return (err as any)?.message ?? err;
	}
}

/**
 * Displays an error message in the VSCode toast notification / modal / console log.
 * Also adds the error into console log.
 */
export function showAndLogError(err: Error | AxiosError<any> | string, actionTitle?: string | undefined) {
	const improvedErrors = errorToString(err);

	// Case of the Modal Popup
	if (err instanceof Error && err.name === 'PopupError') {
		vscode.window.showErrorMessage('Failed ' + (actionTitle ?? ''), {
			detail: improvedErrors.message,
			modal: true,
		});
	} else {
		showErrorDialog((actionTitle ? `FAILED ${actionTitle.toLocaleUpperCase()}: ` : '') + improvedErrors.message);
	}

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
	} else if (err instanceof Error && !improvedErrors.isImproved) {
		// Log to VS Code console
		log('error', improvedErrors.message);
		if (!improvedErrors.isImproved) {
			log('error', `\tSTACK: ${err.stack}`);
		}
	}
}

/**
 * Alias for old usages in JS files.
 * @deprecated Use `showAndLogError()` name instead.
 */
export const showError = showAndLogError;

/**
 * Shows the error message in VS Code toast notification.
 *
 * Note: Does not log the error into error console. If needed to log it, use `showAndLogError()` instead.
 */
export function showErrorDialog(message: string, messageOptions: vscode.MessageOptions = {}): void {
	vscode.window
		.showErrorMessage(
			message,
			messageOptions,
			{ title: 'OK' },
			{ title: 'Show error log', isCloseAffordance: true },
		)
		.then((userResponse) => {
			if (userResponse?.title === 'Show error log') {
				showLog();
			}
		});
}

/**
 * Function wrapper, which catches errors in async functions and displays them in the VSCode window.
 */
export function catchError<T extends (...args: any[]) => Promise<any>>(errorTitle: string, asyncFunc: T): T {
	return <T>(async (...args: any[]) => {
		try {
			return await asyncFunc(...args);
		} catch (err: any) {
			showAndLogError(err, errorTitle);
		}
	});
}

/**
 * Improves the specific error message to more user friendly one. In all other cases returns undefined.
 */
function getImprovedErrorMessage(message: string): string | undefined {
	if (message === "Value doesn't match pattern in parameter 'name'.") {
		return 'Some local component has the invalid ID (name) defined. The ID must follow specific restrictions of used letters, numbers, and symbols.';
	}
	if (message.includes(' in JSONC at position ')) {
		return 'JSON has corrupted structure. Code cannot be deployed. Find and fix the error and try to deploy again.';
	}

	// TODO Keep until the bug `CDM-10287` not resolved, then remove.
	if (message === 'Primary connection must not be the same as the alternative one.') {
		return (
			message +
			' THIS ERROR MESSAGE CAN BE THE PART OF THE KNOWN BUG. Workaround: Try to change "connection" and "alternative connection" one by one, not together.'
		);
	}
	if (message === 'Connection cannot be deleted when alternative connection exists.') {
		return (
			message +
			' THIS ERROR MESSAGE CAN BE THE PART OF THE KNOWN BUG. Workaround: Try to remove the "alternative connection" separately first.'
		);
	}

	return undefined;
}

/**
 * Process the list of error messages and when some is generic known message, replaces it by more user friendly one.
 * Note: User friendly messages are prioritized, so moved to the top of the list.
 */
function improveSomeErrors(messages: string[]): { messages: string[]; isImproved: boolean } {
	const improvedMessages = messages
		.map(getImprovedErrorMessage)
		.filter((message) => message !== undefined) as string[];
	const otherMessages = messages.filter((message) => !getImprovedErrorMessage(message));
	return {
		isImproved: improvedMessages.length > 0,
		messages: [
			// Prioritize the messages with "improved" text
			...improvedMessages,
			// Then display others (with the original text)
			...otherMessages,
		],
	};
}
