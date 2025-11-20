import type * as vscode from 'vscode';
import type { VscodeLibWrapperWindowInterface } from '../types';

export const vsCodeLibWrapperWindowImplementationForIDE: VscodeLibWrapperWindowInterface = {
	showErrorMessage: (async () => {
		throw new Error('showErrorMessage is not implemented in CLI yet');
	}) as typeof vscode.window.showErrorMessage as any, // Because of multiple overloads. Only one overload is implemented in CLI variant.
	showWarningMessage: (async () => {
		throw new Error('showWarningMessage is not implemented in CLI yet');
	}) as typeof vscode.window.showWarningMessage as any, // Because of multiple overloads. Only one overload is implemented in CLI variant.
	showInformationMessage: (async () => {
		throw new Error('showInformationMessage is not implemented in CLI yet');
	}) as typeof vscode.window.showInformationMessage as any, // Because of multiple overloads. Only one overload is implemented in CLI variant.
	showInputBox: (async () => {
		throw new Error('showInputBox is not implemented in CLI yet');
	}) as typeof vscode.window.showInputBox as any, // Because of multiple overloads. Only one overload is implemented in CLI variant.
	showQuickPick: (async () => {
		throw new Error('showQuickPick is not implemented in CLI yet');
	}) as typeof vscode.window.showQuickPick as any, // Because of multiple overloads. Only one overload is implemented in CLI variant.
	get activeTextEditor(): typeof vscode.window.activeTextEditor {
		throw new Error('activeTextEditor is not implemented in CLI yet');
	},
};
