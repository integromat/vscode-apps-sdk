export function startAppInsights() {
	// No telemetry implementation in CLI mode
}

/**
 * General function to send telemetry event with parameters
 */
export function sendTelemetry(_eventName: string, _stringObj?: any, numericObj?: any) {
	if (isTelemetryEnabled()) {
		// No telemetry implementation in CLI mode
	}
}

/**
 * General function to send telemetry Error event with parameters
 */
export function sendTelemetryError(_eventName: string, _stringObj?: any, _numericObj?: any) {
	if (isTelemetryEnabled()) {
		// No telemetry implementation in CLI mode
	}
}

/**
 * Function to disable telemetry on user's demand
 * May this be possibly constant, as the value changes only on restart?
 */
export function isTelemetryEnabled() {
	return false; // Telemetry is not available in CLI mode
}
