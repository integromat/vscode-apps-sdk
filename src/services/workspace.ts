import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as IWorkspaceIDE from './workspace-ide';
import type * as IWorkspaceCLI from './workspace-cli';

const mode = ideCliMode.mode;
let actualImplementation: typeof IWorkspaceIDE | typeof IWorkspaceCLI;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./workspace-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./workspace-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

/**
 * @returns The current workspace folder object.
 * In IDE mode, the workspace is the first opened folder in VS Code.
 * In CLI mode, the workspace is the directory provided by CLI option `--local-dir <filesystem-path>`.
 */
export const getCurrentWorkspace = actualImplementation.getCurrentWorkspace;
