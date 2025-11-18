import { vsCodeLibWrapperWindowImplementationForIDE } from './window';
import { vsCodeLibWrapperWorkspaceImplementationForIDE } from './workspace';
import { vsCodeLibWrapperCommandsImplementationForIDE } from './commands';
import { Uri } from './uri';
import type { VscodeLibWrapperInterface } from '../types';
import { FileType } from '../vscode-file-type.enum';

export const vscodeLibWrapperImplementationForIDE: VscodeLibWrapperInterface = {
	commands: vsCodeLibWrapperCommandsImplementationForIDE,
	window: vsCodeLibWrapperWindowImplementationForIDE,
	workspace: vsCodeLibWrapperWorkspaceImplementationForIDE,
	Uri: Uri,
	FileType: FileType,
};
