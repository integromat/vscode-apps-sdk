import * as vscode from 'vscode';
import type { VscodeLibWrapperWindowInterface } from '../types';

export const vsCodeLibWrapperWindowImplementationForIDE: VscodeLibWrapperWindowInterface = {
	// Each of these forwards to the actual `vscode` implementation.
	// The `as any` casts are needed because only one of the multiple `vscode` overloads is mirrored in the wrapper interface.
	showErrorMessage: ((...args: any[]) => (vscode.window.showErrorMessage as any)(...args)) as any,
	showWarningMessage: ((...args: any[]) => (vscode.window.showWarningMessage as any)(...args)) as any,
	showInformationMessage: ((...args: any[]) => (vscode.window.showInformationMessage as any)(...args)) as any,
	showInputBox: ((...args: any[]) => (vscode.window.showInputBox as any)(...args)) as any,
	showQuickPick: ((...args: any[]) => (vscode.window.showQuickPick as any)(...args)) as any,
	get activeTextEditor(): typeof vscode.window.activeTextEditor {
		return vscode.window.activeTextEditor;
	},
};
