import * as vscode from 'vscode';
import type { VscodeLibWrapperFsInterface } from '../types';

export const vsCodeLibWrapperFsImplementationForIDE: VscodeLibWrapperFsInterface = {
	writeFile: async (_uri: any, _content: Uint8Array): Promise<void> => {
		return vscode.workspace.fs.writeFile(_uri, _content);
	},
	readFile: async (_uri: any): Promise<Uint8Array> => {
		return vscode.workspace.fs.readFile(_uri);
	},
	delete: async (_uri: any, _options?: { recursive: boolean; useTrash?: boolean | undefined }): Promise<void> => {
		return vscode.workspace.fs.delete(_uri, _options);
	},
	stat: async (_uri: any): Promise<vscode.FileStat> => {
		return vscode.workspace.fs.stat(_uri);
	},
	createDirectory: async (_uri: any): Promise<void> => {
		return vscode.workspace.fs.createDirectory(_uri);
	},
	readDirectory: async (_uri: any): Promise<[string, vscode.FileType][]> => {
		return vscode.workspace.fs.readDirectory(_uri);
	},
};
