import * as IVscode from 'vscode';

/**
 * The interface mirrors the subset of the VSCode API used in the project.
 * The insterface should have the same structure and have the most similar interface as `vscode` module,
 * buy all types should be replaced by internal/own one. I means NO USAGE of any `vscode.*` types in this interface.
 */
export interface VscodeLibWrapperInterface {
	commands: VsCodeLibWrapperCommandsInterface;
	window: VscodeLibWrapperWindowInterface;
	workspace: VscodeLibWrapperWorkspaceInterface;
	Uri: typeof IVscode.Uri;
	FileType: typeof IVscode.FileType;
}

export interface VsCodeLibWrapperCommandsInterface {
	registerCommand: (command: string, callback: (...args: any[]) => any) => void;
	executeCommand: <T = unknown>(command: string, ...rest: any[]) => Promise<T | undefined>;
}

export interface VscodeLibWrapperWindowInterface {
	showErrorMessage: <T extends IVscode.MessageItem>(
		message: string,
		options?: IVscode.MessageOptions,
		...items: T[]
	) => Promise<T | undefined>;
	showWarningMessage: <T extends IVscode.MessageItem>(
		message: string,
		options?: IVscode.MessageOptions,
		...items: T[]
	) => Promise<T | undefined>;
	showInformationMessage: <T extends IVscode.MessageItem>(
		message: string,
		options?: IVscode.MessageOptions,
		...items: T[]
	) => Promise<T | undefined>;
	showInputBox: (options?: IVscode.InputBoxOptions) => Promise<string | undefined>;
	showQuickPick: <T extends IVscode.QuickPickItem>(
		items: readonly T[],
		options?: IVscode.QuickPickOptions,
	) => Promise<T | undefined>;
	readonly activeTextEditor: IVscode.TextEditor | undefined;
}

export interface VscodeLibWrapperWorkspaceInterface {
	asRelativePath: typeof IVscode.workspace.asRelativePath;
	fs: VscodeLibWrapperFsInterface;
}

export interface VscodeLibWrapperFsInterface {
	readFile: typeof IVscode.workspace.fs.readFile;
	writeFile: typeof IVscode.workspace.fs.writeFile;
	stat: typeof IVscode.workspace.fs.stat;
	readDirectory: typeof IVscode.workspace.fs.readDirectory;
	createDirectory: typeof IVscode.workspace.fs.createDirectory;
	delete: typeof IVscode.workspace.fs.delete;
}

// `FileSystemError` vscode interface -  Even though it is used in `local-development`, it is not needed to be reimplemented, because it is internal type only without any interface.

// `FileType` vscode interface - Even though it is used in `local-development`, it is not needed to reimplement, because it is type only, without any external interface

// `vscode.commands` section - Not needed/used in CLI mode, so not implemented
