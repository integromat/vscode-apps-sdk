import type * as IVscode from 'vscode';
import type { LocalAppOrigin } from './types/makecomapp.types.js';

/**
 * CLI implementation of asking user for API token (if secret file is missing in origin configuration).
 * In CLI mode, the API token is expected to be provided via environment variable "MAKE_API_TOKEN".
 *
 * @return API token
 */
export async function askAddMissingApiKey(_origin: LocalAppOrigin, _makeappRootdir: IVscode.Uri): Promise<string> {
	const apiKey = process.env.MAKE_API_TOKEN;
	if (!apiKey) {
		throw new Error(
			`API token is missing. Please set the environment variable MAKE_API_TOKEN with your API token and try again.`,
		);
	}
	return apiKey;
}
