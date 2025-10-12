import debugFactory from 'debug';
import * as fs from 'fs/promises';
import type { VsCodeWrapperUri } from '../uri';

const debug = debugFactory('app:vscode-cli-override');

export const vsCodeLibWrapperFsImplementationForCLI = {
	readFile: (async (uri: typeof VsCodeWrapperUri): Promise<Uint8Array> => {
		debug(`Reading file from path: ${uri.fsPath}`);
		return fs.readFile(uri.fsPath);
	}) as typeof vscode.workspace.fs.readFile,
	writeFile: (async (uri: typeof VsCodeWrapperUri, content: Uint8Array) => {
		throw new Error('writeFile is not implemented in CLI mock');
		// return fs.writeFile(uri.fsPath, content);
	}) as typeof vscode.workspace.fs.writeFile,
	stat: (async (uri: typeof VsCodeWrapperUri) => {
		throw new Error('stat is not implemented in CLI mock');
	}) as typeof vscode.workspace.fs.stat,
	readDirectory: (async (uri: typeof VsCodeWrapperUri) => {
		throw new Error('readDirectory is not implemented in CLI mock');
	}) as typeof vscode.workspace.fs.readDirectory,
	createDirectory: (async (uri: typeof VsCodeWrapperUri) => {
		throw new Error('createDirectory is not implemented in CLI mock');
	}) as typeof vscode.workspace.fs.createDirectory,
	delete: (async (uri: typeof VsCodeWrapperUri) => {
		throw new Error('delete is not implemented in CLI mock');
	}) as typeof vscode.workspace.fs.delete,
};
