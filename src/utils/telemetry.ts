import { ideCliMode } from '../services/ide-or-cli-mode';
import type * as ITelemetryIDE from './telemetry-ide';
import type * as ITelemetryCLI from './telemetry-cli';

const mode = ideCliMode.mode;
let actualImplementation: typeof ITelemetryIDE | typeof ITelemetryCLI;
switch (mode) {
	case 'ide':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./telemetry-ide');
		break;
	case 'cli':
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		actualImplementation = require('./telemetry-cli');
		break;
	default:
		throw new Error(`Unknown ideCliMode: ${mode}`);
}

export const startAppInsights = actualImplementation.startAppInsights;
export const sendTelemetry = actualImplementation.sendTelemetry;
export const sendTelemetryError = actualImplementation.sendTelemetryError;
export const isTelemetryEnabled = actualImplementation.isTelemetryEnabled;
