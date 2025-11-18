import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as IWorkspaceIDE from './workspace-ide';
import type * as IWorkspaceCLI from './workspace-cli';

const mode = ideCliMode.mode;
let logModule: typeof IWorkspaceIDE | typeof IWorkspaceCLI;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./workspace-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./workspace-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

export const getCurrentWorkspace = logModule.getCurrentWorkspace;
