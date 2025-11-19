/* eslint @typescript-eslint/no-unused-vars: "warn" */ // TODO remove this line after full implementation
import type * as IVscode from 'vscode';
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

function showErrorMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	throw new Error('showErrorMessage is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function showWarningMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	throw new Error('showWarningMessage is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function showInformationMessage<T extends IVscode.MessageItem>(
	message: string,
	options?: IVscode.MessageOptions,
	...items: T[]
): Promise<T | undefined> {
	throw new Error('showInformationMessage is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function showInputBox(options?: IVscode.InputBoxOptions): Promise<string | undefined> {
	throw new Error('showInputBox is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function showQuickPick<T extends IVscode.QuickPickItem>(
	items: readonly T[],
	options?: IVscode.QuickPickOptions,
): Promise<T | undefined> {
	throw new Error('showQuickPick is not implemented in CLI yet');
	// TODO: Implement CLI version
}

function getActiveTextEditor(): IVscode.TextEditor | undefined {
	throw new Error('activeTextEditor is not implemented in CLI yet');
}
