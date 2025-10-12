import type { VsCodeWrapperUri } from './uri';

/**
 * The interface mirrors the subset of the VSCode API used in the project.
 * The insterface should have the same structure and have the most similar interface as `vscode` module,
 * buy all types should be replaced by internal/own one. I means NO USAGE of any `vscode.*` types in this interface.
 */
export interface VscodeLibWrapperInterface {
	commands: VsCodeLibWrapperCommandsInterface;
	window: VscodeLibWrapperWindowInterface;
	workspace: VscodeLibWrapperWorkspaceInterface;
	Uri: typeof VsCodeWrapperUri;
}

export interface VsCodeLibWrapperCommandsInterface {
	registerCommand: (command: string, callback: (...args: any[]) => any) => void;
	executeCommand: <T = unknown>(command: string, ...rest: any[]) => Promise<T | undefined>;
}

export interface VscodeLibWrapperWindowInterface {
	showErrorMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
	showWarningMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
	showInformationMessage: (message: string, ...items: string[]) => Promise<string | undefined>;
	showInputBox: (options?: import('vscode').InputBoxOptions) => Promise<string | undefined>;
	showQuickPick: (
		items: readonly string[],
		options?: import('vscode').QuickPickOptions,
	) => Promise<string | undefined>;
	readonly activeTextEditor: import('vscode').TextEditor | undefined;
}

export interface VscodeLibWrapperWorkspaceInterface {
	asRelativePath: typeof import('vscode').workspace.asRelativePath;
	fs: VscodeLibWrapperFsInterface;
}

export interface VscodeLibWrapperFsInterface {
	readFile: typeof import('vscode').workspace.fs.readFile;
	writeFile: typeof import('vscode').workspace.fs.writeFile;
	stat: typeof import('vscode').workspace.fs.stat;
	readDirectory: typeof import('vscode').workspace.fs.readDirectory;
	createDirectory: typeof import('vscode').workspace.fs.createDirectory;
	delete: typeof import('vscode').workspace.fs.delete;
}

// `FileSystemError` vscode interface -  Even though it is used in `local-development`, it is not needed to be reimplemented, because it is internal type only without any interface.

// `FileType` vscode interface - Even though it is used in `local-development`, it is not needed to reimplement, because it is type only, without any external interface

// `vscode.commands` section - Not needed/used in CLI mode, so not implemented
