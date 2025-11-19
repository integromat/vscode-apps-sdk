/**
 * Gets the configuration for Make.com API.
 *
 * - API key
 * - API Base URL
 *
 * For IDE: Gets the configuration from actual Make Extension Environment.
 * For CLI: Gets the configuration from environment variables / command line parameters.
 */

import { getCurrentCliContext } from '../cli/cli-context';
import { ideCliMode } from '../services/ide-or-cli-mode';

export async function getApikeyConfiguration(): Promise<string> {
	if (ideCliMode.mode === 'ide') {
		return (await _getConfiguration()).apikey;
	} else {
		return _getApiKeyConfigurationCLI();
	}
}

export async function getApiBaseUrlConfiguration(): Promise<string> {
	if (ideCliMode.mode === 'ide') {
		return 'https://' + (await _getConfiguration()).url; // Note: The `url` already containts the `/api` path.
	} else {
		return _getApiBaseUrlConfigurationCLI();
	}
}

async function _getConfiguration() {
	const { getCurrentEnvironment } = await import('./configuration.js');
	return getCurrentEnvironment();
}

/**
 * Gets the API key configuration for CLI from ENVIRONMENT variable "MAKE_API_TOKEN".
 * @private
 */
async function _getApiKeyConfigurationCLI(): Promise<string> {
	const apiKey = process.env.MAKE_API_TOKEN;
	if (!apiKey) {
		throw new Error(
			`API token is missing. Please set the environment variable MAKE_API_TOKEN with your API token and try again.`,
		);
	}
	return apiKey;
}

/**
 * Gets the API base URL configuration from CLI parameters.
 * @private
 */
async function _getApiBaseUrlConfigurationCLI(): Promise<string> {
	const makeHost = getCurrentCliContext().options.makeHost as string | undefined;
	if (!makeHost) {
		throw new Error(
			`Make host is missing. Please set the CLI option --make-host with your Make host and try again.`,
		);
	}
	return `https://${makeHost}/api`;
}
