import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as ITelemetryIDE from './telemetry-ide';
import type * as ITelemetryCLI from './telemetry-cli';

const mode = ideCliMode.mode;
let logModule: typeof ITelemetryIDE | typeof ITelemetryCLI;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./telemetry-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		logModule = require('./telemetry-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

export const startAppInsights = logModule.startAppInsights;
export const sendTelemetry = logModule.sendTelemetry;
export const sendTelemetryError = logModule.sendTelemetryError;
export const isTelemetryEnabled = logModule.isTelemetryEnabled;
