/* eslint @typescript-eslint/no-unused-vars: "warn" */ // TODO remove this line after full implementation
import type * as IVscode from 'vscode';
import debugFactory from 'debug';
import * as fs from 'fs/promises';

const debug = debugFactory('app:vscode-cli-override');

export const vsCodeLibWrapperFsImplementationForCLI = {
	readFile: (async (uri: IVscode.Uri): Promise<Uint8Array> => {
		debug(`Reading file from path: ${uri.fsPath}`);
		return fs.readFile(uri.fsPath);
	}) as typeof IVscode.workspace.fs.readFile,
	writeFile: (async (uri: IVscode.Uri, content: Uint8Array) => {
		throw new Error('writeFile is not implemented in CLI yet');
		// return fs.writeFile(uri.fsPath, content);
	}) as typeof IVscode.workspace.fs.writeFile,
	stat: (async (uri: IVscode.Uri) => {
		throw new Error('stat is not implemented in CLI yet');
	}) as typeof IVscode.workspace.fs.stat,
	readDirectory: (async (uri: IVscode.Uri) => {
		throw new Error('readDirectory is not implemented in CLI yet');
	}) as typeof IVscode.workspace.fs.readDirectory,
	createDirectory: (async (uri: IVscode.Uri) => {
		throw new Error('createDirectory is not implemented in CLI yet');
	}) as typeof IVscode.workspace.fs.createDirectory,
	delete: (async (uri: IVscode.Uri) => {
		throw new Error('delete is not implemented in CLI yet');
	}) as typeof IVscode.workspace.fs.delete,
};
