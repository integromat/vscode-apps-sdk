import * as vscode from 'vscode';
/**
 * This is modified module `vscode`. It reimplements the VSCode API for usages in a CLI environment.
 *
 * It overrides all VSCode API methods used in `src/local-development/**` directory, which:
 * - use the native VSCode UI interface (like dialogs, popups, etc.),
 * - or provides API for filesystem access to a workspace.
 * - TODO maybe I missing some important use cases. Add if some more reimplementation needed.
 */
export const cliModificationOfVscodeLib: typeof vscode = {
	...vscode,

	// Window API (only methods used in local-development)
	window: {
		...vscode.window,
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
	},

	// Workspace API (only methods used in local-development)
	workspace: {
		...vscode.workspace,
		asRelativePath: (() => {
			throw new Error('asRelativePath is not implemented in CLI mock');
		}) as typeof vscode.workspace.asRelativePath,
		fs: {
			...vscode.workspace.fs,
			readFile: (async () => {
				throw new Error('readFile is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.readFile,
			writeFile: (async () => {
				throw new Error('writeFile is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.writeFile,
			stat: (async () => {
				throw new Error('stat is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.stat,
			readDirectory: (async () => {
				throw new Error('readDirectory is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.readDirectory,
			createDirectory: (async () => {
				throw new Error('createDirectory is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.createDirectory,
			delete: (async () => {
				throw new Error('delete is not implemented in CLI mock');
			}) as typeof vscode.workspace.fs.delete,
		},
	},

	// TODO Check if this is really needed to implement, or CLI not uses it.
	commands: {
		...vscode.commands,
		registerCommand: (() => {
			throw new Error('registerCommand is not implemented in CLI mock');
		}) as typeof vscode.commands.registerCommand,
		executeCommand: (async () => {
			throw new Error('executeCommand is not implemented in CLI mock');
		}) as typeof vscode.commands.executeCommand,
	},

	// `Uri` class - Even though it is used in `local-development`, it is not needed to be reimplemented, because it is internal manipulating with Url object only, without any external interface.

	// `FileSystemError` class -  Even though it is used in `local-development`, it is not needed to be reimplemented, because it is internal type only without any interface.

	// `FileType` enum - Even though it is used in `local-development`, it is not needed to reimplement, because it is type only, without any external interface
};
