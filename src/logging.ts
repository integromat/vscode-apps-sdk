import { ideCliMode } from './services/ide-or-cli-mode';
import type * as logIde from './logging-ide';
import type * as logCli from './logging-cli';

const mode = ideCliMode.mode;
let logModule: typeof logIde | typeof logCli;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./logging-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./logging-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

/**
 * Logs error into output console `Make Apps SDK extension`.
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', errorMessage: string) {
	logModule.log(level, errorMessage);
}

export const showLog = logModule.showLog;
