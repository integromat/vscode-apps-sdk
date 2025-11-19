import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as IVscodeProgressDialogIDE from './vscode-progress-dialog-ide';
import type * as IVscodeProgressDialogCLI from './vscode-progress-dialog-cli';

const mode = ideCliMode.mode;
let actualImplementation: typeof IVscodeProgressDialogIDE | typeof IVscodeProgressDialogCLI;

switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./vscode-progress-dialog-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./vscode-progress-dialog-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

/**
 * Shows progress dialog with given options while executing the given async function.
 */
export const withProgressDialog = actualImplementation.withProgressDialog;

/**
 * Updates progress dialog detailed text.
 */
export const progresDialogReport = actualImplementation.progresDialogReport;
