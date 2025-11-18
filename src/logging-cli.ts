/**
 * @module
 * provides the ability to write logs to for CLI application`.
 */

/**
 * Logs error into output console `Make Apps SDK extension`.
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', errorMessage: string) {
	const rawLogLine = level.toUpperCase() + ': ' + errorMessage;

	// debug, info to console.log, warn and error to console.error
	if (level === 'debug' || level === 'info') {
		console.log(rawLogLine);
	} else {
		console.error(rawLogLine);
	}
}

/**
 * Nothing to implement in CLI mode.
 * Note: In IDE mode, it displays the windows with logs.
 */
export function showLog() {
	// ignore
}
