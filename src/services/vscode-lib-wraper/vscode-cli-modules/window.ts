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
    // Basic CLI implementation using Enquirer select
    // Note: Only single-pick is supported. If VSCode's canPickMany is provided, we ignore it for now
    // and behave as single pick to keep CLI UX simple.
    if (!items || items.length === 0) {
        return undefined;
    }

    // Determine initially picked index (first item with picked=true), otherwise default to 0
    const initialIndex = Math.max(
        0,
        items.findIndex((i) => (i as IVscode.QuickPickItem).picked === true),
    );

    const formatMessage = (item: IVscode.QuickPickItem): string => {
        const base = item.label ?? '';
        const desc = item.description ? ` — ${item.description}` : '';
        const detail = item.detail ? `\n${item.detail}` : '';
        return `${base}${desc}${detail}`;
    };

    const message =
        (options?.title || options?.placeHolder || 'Select an option') +
        (options?.matchOnDescription || options?.matchOnDetail ? '' : '');

    const response = await Enquirer.prompt<{ select1: string }>(
        {
            type: 'select',
            name: 'select1',
            message,
            choices: [
                ...items.map((item, index) => ({
                    name: String(index),
                    message: formatMessage(item),
                })),
                { name: '--Cancel--', message: 'Cancel✖️' },
            ],
            // Enquirer supports numeric index for "initial"
            initial: initialIndex,
        } as any, // cast due to Enquirer typings differences
    ).catch(() => undefined);

    if (response?.select1 === undefined || response?.select1 === '--Cancel--') {
        return undefined;
    }
    return items[parseInt(response.select1)];
}

function getActiveTextEditor(): IVscode.TextEditor | undefined {
	throw new Error('activeTextEditor is not implemented in CLI yet');
}
