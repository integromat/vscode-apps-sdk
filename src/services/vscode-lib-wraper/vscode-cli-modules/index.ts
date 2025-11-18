import { vsCodeLibWrapperWindowImplementationForCLI } from './window';
import { vsCodeLibWrapperWorkspaceImplementationForCLI } from './workspace';
import type { VscodeLibWrapperInterface } from '../types';
import { Uri } from './uri';
import { vsCodeLibWrapperCommandsImplementationForCLI } from './commands';
import { FileType } from '../vscode-file-type.enum';

export const vscodeLibWrapperImplementationForCLI: VscodeLibWrapperInterface = {
	commands: vsCodeLibWrapperCommandsImplementationForCLI,
	window: vsCodeLibWrapperWindowImplementationForCLI,
	workspace: vsCodeLibWrapperWorkspaceImplementationForCLI,
	Uri: Uri,
	FileType: FileType,
};
