import TelemetryReporter from '@vscode/extension-telemetry';
import * as appInsights from 'applicationinsights';
import { getConfiguration } from '../providers/configuration';

const _configuration = getConfiguration();
const azureInstrumentationKey = 'f9b9d6d5-2058-46ae-9ba8-56bc993474e3';
const telemetryReporter = new TelemetryReporter(azureInstrumentationKey);

/**
 * @module
 * provides the ability to report app usage
 */

/**
 * Primitive function to create instance - can be class/singleton in future
 */
export function getTelemetryReporter(): TelemetryReporter {
	return telemetryReporter;
}

/**
 * Primitive function to start app insights
 */
export function startAppInsights() {
	appInsights
		.setup(azureInstrumentationKey)
		.setAutoCollectRequests(true)
		.setAutoCollectPerformance(true, true)
		.setAutoCollectExceptions(true)
		.setAutoCollectDependencies(true)
		.setAutoCollectConsole(true, false)
		.setAutoCollectPreAggregatedMetrics(true)
		.setSendLiveMetrics(false)
		.setInternalLogging(false, true)
		.enableWebInstrumentation(false)
		.start();
}

/**
 * General function to send telemetry event with parameters
 */
export function sendTelemetry(eventName: string, stringObj?: any, numericObj?: any) {
	if (isTelemetryEnabled()) {
		telemetryReporter.sendTelemetryEvent(eventName, stringObj, numericObj);
	}
}

/**
 * General function to send telemetry Error event with parameters
 */
export function sendTelemetryError(eventName: string, stringObj?: any, numericObj?: any) {
	if (isTelemetryEnabled()) {
		telemetryReporter.sendTelemetryErrorEvent(eventName, stringObj, numericObj);
	}
}

/**
 * Function to disable telemetry on user's demand
 * May this be possibly constant, as the value changes only on restart?
 */
export function isTelemetryEnabled() {
	if (_configuration.get('telemetry') && _configuration.get('telemetry.disableTelemetry')) {
		return false;
	} else {
		return true;
	}
}
