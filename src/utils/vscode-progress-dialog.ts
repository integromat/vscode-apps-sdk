import { ideCliMode } from '../services/ide-or-cli-mode';

const mode = ideCliMode.mode;
let libModule: typeof import('./vscode-progress-dialog-ide') | typeof import('./vscode-progress-dialog-cli');

switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		libModule = require('./vscode-progress-dialog-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		libModule = require('./vscode-progress-dialog-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

/**
 * Shows progress dialog with given options while executing the given async function.
 */
export const withProgressDialog = libModule.withProgressDialog;

/**
 * Updates progress dialog detailed text.
 */
export const progresDialogReport = libModule.progresDialogReport;
