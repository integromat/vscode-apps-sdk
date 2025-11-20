/* eslint @typescript-eslint/no-unused-vars: "warn" */ // TODO remove this line after full implementation
import type * as IVscode from 'vscode';
import Enquirer from 'enquirer';
import type { VscodeLibWrapperWindowInterface } from '../types';

export const vsCodeLibWrapperWindowImplementationForCLI: VscodeLibWrapperWindowInterface = {
	showErrorMessage,
	showWarningMessage,
	showInformationMessage,
	showInputBox,
	showQuickPick,
	get activeTextEditor() {
		return getActiveTextEditor();
	},
};

async function showErrorMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	if (!options?.modal) {
		console.error(`ERROR: ${message}`);
		if (options?.detail) {
			console.error(`  DETAIL: ${options.detail}`);
		}
		return items[0];
	} else {
		console.log('----- ERROR ERROR ERROR -----');
		return showInformationMessage(message, options, ...items);
	}
}

async function showWarningMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	if (!options?.modal) {
		console.warn(`WARNING: ${message}`);
		if (options?.detail) {
			console.warn(`  DETAIL: ${options.detail}`);
		}
		return items[0];
	} else {
		console.log('----- WARNING WARNING WARNING -----');
		return showInformationMessage(message, options, ...items);
	}
}

/**
 * Note: Reused also for warning and error modal dialogs.
 */
async function showInformationMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	if (!options?.modal) {
		console.log(`INFO: ${message}`);
		if (options?.detail) {
			console.log(`  DETAIL: ${options.detail}`);
		}
		return items[0];
	} else {
		// Ask user for selection of one of the items before continuing.
		const response = await Enquirer.prompt<{ select1: string }>({
			type: 'select',
			name: 'select1',
			message: message + (options?.detail ? `\n\n${options.detail}` : ''),

			choices: [
				...items.map((item, index) => ({
					name: String(index), // returns the index of the selected item (must be as string)
					message: item.title,
				})),
				{
					name: '--Cancel--',
					message: 'Cancel✖️',
				},
			],
		}).catch(() => undefined); // Catch user abort (Escape key
		if (response?.select1 === undefined || response?.select1 === '--Cancel--') {
			// User cancelled the modal dialog
			return undefined;
		}
		// Return whole original item object
		return items[parseInt(response.select1)];
	}
}

/**
 * Input box dialog to ask user for text input.
 * Uses `Enquirer` for CLI implementation.
 */
async function showInputBox(options?: IVscode.InputBoxOptions): Promise<string | undefined> {
	const response = await Enquirer.prompt<{ input1: string }>({
		type: 'input',
		name: 'input1',
		message: (options?.prompt || 'Please enter input:') + (options?.placeHolder ? ` (${options.placeHolder})` : ''),
		initial: options?.value || '',
	}).catch(() => undefined);
	return response?.input1;
}

async function showQuickPick<T extends IVscode.QuickPickItem>(
	items: readonly T[],
	options?: IVscode.QuickPickOptions,
): Promise<T | undefined> {
	throw new Error('showQuickPick is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function getActiveTextEditor(): IVscode.TextEditor | undefined {
	throw new Error('activeTextEditor is not implemented in CLI yet');
}
