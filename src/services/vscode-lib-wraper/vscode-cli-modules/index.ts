// import debugFactory from 'debug';
import { vsCodeLibWrapperWindowImplementationForCLI } from './window';
import { vsCodeLibWrapperWorkspaceImplementationForCLI } from './workspace';
import type { VscodeLibWrapperInterface } from '../types';
import { VsCodeWrapperUri } from '../uri';
import { vsCodeLibWrapperCommandsImplementationForCLI } from './commands';

// const debug = debugFactory('app:vscode-cli-override');

export const vscodeLibWrapperImplementationForCLI: VscodeLibWrapperInterface = {
	commands: vsCodeLibWrapperCommandsImplementationForCLI,
	window: vsCodeLibWrapperWindowImplementationForCLI,
	workspace: vsCodeLibWrapperWorkspaceImplementationForCLI,
	Uri: VsCodeWrapperUri,
};
