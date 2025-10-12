// import debugFactory from 'debug';
import { vsCodeLibWrapperWindowImplementationForIDE } from './window';
import { vsCodeLibWrapperWorkspaceImplementationForIDE } from './workspace';
import { VsCodeWrapperUri } from '../uri';
import type { VscodeLibWrapperInterface } from '../types';
import { vsCodeLibWrapperCommandsImplementationForIDE } from './commands';

// const debug = debugFactory('app:vscode-cli-override');

export const vscodeLibWrapperImplementationForCLI: VscodeLibWrapperInterface = {
	commands: vsCodeLibWrapperCommandsImplementationForIDE,
	window: vsCodeLibWrapperWindowImplementationForIDE,
	workspace: vsCodeLibWrapperWorkspaceImplementationForIDE,
	Uri: VsCodeWrapperUri,
};
