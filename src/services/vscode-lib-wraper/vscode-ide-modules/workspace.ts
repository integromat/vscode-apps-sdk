import * as vscode from 'vscode';
import type { VscodeLibWrapperWorkspaceInterface } from '../types';
import { vsCodeLibWrapperFsImplementationForIDE } from './fs';

export const vsCodeLibWrapperWorkspaceImplementationForIDE: VscodeLibWrapperWorkspaceInterface = {
	// forward request to the actual `vscode` implementation
	asRelativePath: ((...args: any[]) => (vscode.workspace.asRelativePath as any)(...args)) as any,
	fs: vsCodeLibWrapperFsImplementationForIDE,
};
