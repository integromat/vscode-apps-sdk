import * as vscode from 'vscode';
import { log } from '../output-channel';

/**
 * Gets the extension configuration stored in VS Code settings.json file under keys `apps-sdk.*`.
*/
export function getConfiguration(): AppsSdkConfiguration {
	return vscode.workspace.getConfiguration('apps-sdk') as AppsSdkConfiguration;
}


/**
 * Describes the configuration structure of key `apps-sdk` in the VS Code configuration file.
 */
export interface AppsSdkConfiguration extends vscode.WorkspaceConfiguration {
	login: boolean;
	environments: AppsSdkConfigurationEnvironment[];
	environment: AppsSdkConfigurationEnvironment['uuid'];
}


export interface AppsSdkConfigurationEnvironment {
	name: string;
	uuid: string;
	apikey: string;
	version: number;
	url: string;

	unsafe?: boolean;
	noVersionPath?: boolean;
	admin?: boolean;
}

/**
 * User can define multiple environmnents.
 * Function returns the one that is currently selected by user.
 *
 * @throws {Error} If no environment is selected, if selected environment is not found in the configuration,
 *                 or if the selected environment is not using API v2.
 */
export function getCurrentEnvironment(): AppsSdkConfigurationEnvironment {
	const _configuration = getConfiguration();
	const environments = _configuration.get<AppsSdkConfiguration['environments']>('environments');
	if (!environments) {
		const err = "No configuration found in 'apps-sdk.environments'. Check your configuration.";
		log('error', err);
		throw new Error(err);
	}
	const selectedEnvironment = environments.find((e: any) => e.uuid === _configuration.environment);
	if (!selectedEnvironment) {
		throw new Error("Selected environment ('apps-sdk.environment') not found in 'apps-sdk.environments'. Check your configuration.");
	}
	if (selectedEnvironment.version !== 2) {
		throw new Error(
			`Environment "${selectedEnvironment.name}" uses unsupported API v${selectedEnvironment.version ?? '(not set)'}. ` +
				'Only Make API v2 is supported — please update this environment\'s version, or add a new one.',
		);
	}
	return selectedEnvironment;
}

