export const vsCodeLibWrapperWindowImplementationForCLI = {
	showErrorMessage: (async () => {
		throw new Error('showErrorMessage is not implemented in CLI mock');
	}) as typeof vscode.window.showErrorMessage,
	showWarningMessage: (async () => {
		throw new Error('showWarningMessage is not implemented in CLI mock');
	}) as typeof vscode.window.showWarningMessage,
	showInformationMessage: (async () => {
		throw new Error('showInformationMessage is not implemented in CLI mock');
	}) as typeof vscode.window.showInformationMessage,
	showInputBox: (async () => {
		throw new Error('showInputBox is not implemented in CLI mock');
	}) as typeof vscode.window.showInputBox,
	showQuickPick: (async () => {
		throw new Error('showQuickPick is not implemented in CLI mock');
	}) as typeof vscode.window.showQuickPick,
	get activeTextEditor(): typeof vscode.window.activeTextEditor {
		throw new Error('activeTextEditor is not implemented in CLI mock');
	},
};
