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
 * @throws {Error} If no environment is selected or if selected environment is not found in the configuration.
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
	return selectedEnvironment;
}

