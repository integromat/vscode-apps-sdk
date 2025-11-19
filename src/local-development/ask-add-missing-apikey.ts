import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as IAskAddMissingApikeyIDE from './ask-add-missing-apikey-ide';
import type * as IAskAddMissingApikeyCLI from './ask-add-missing-apikey-cli';

const mode = ideCliMode.mode;
let actualModule: typeof IAskAddMissingApikeyIDE | typeof IAskAddMissingApikeyCLI;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualModule = require('./ask-add-missing-apikey-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualModule = require('./ask-add-missing-apikey-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

export const askAddMissingApiKey = actualModule.askAddMissingApiKey;
