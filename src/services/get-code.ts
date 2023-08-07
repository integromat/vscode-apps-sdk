import * as vscode from "vscode";
import { AppsSdkConfigurationEnvironment } from "../providers/configuration";
import * as Core from "../Core";
import axios, { AxiosRequestConfig } from "axios";
import { getAppCodeDefinition, getAppComponentCodeDefinition } from "./component-code-def";
import { AppComponentType } from '../types/app-component-type.types';
import { TextDecoder, TextEncoder } from "util";
import { AppCodeName } from "../types/app-code-name.types";

/**
 * Download the code from the API and save it to the local destination
 * @return void, because the code is saved to the destination file.
 * @param codeName
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function downloadSource({appName, appVersion, appComponentType, appComponentName, codeName, environment, destinationPath}: {
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType | 'app',
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment,
	destinationPath: vscode.Uri,
}): Promise<void> {
	// Get the code from the API
	const axiosResponse = await axios({
		url: getCodeApiUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}),
		headers: {
			'Authorization': 'Token ' + environment.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
		transformResponse: (res) => (res),  // Do not parse the response into JSON
	});

	// Prepare a stream to be saved
	let codeContent: string = axiosResponse.data;

	// Fix null value -- DON'T FORGET TO CHANGE IN IMPORT WHEN CHANGING THIS
	// Happends on legacy Integromat only, where DB null value is directly returned without filling the default value "{}"|"[]"
	if (codeContent === "null") {
		if (codeName === 'samples') {
			codeContent = '{}';
		} else {
			codeContent = '[]';
		}
	}

	// Save the received code to the temp directory
	const codeContentUint8 = new TextEncoder().encode(codeContent);
	await vscode.workspace.fs.writeFile(destinationPath, codeContentUint8);
}


/**
 * Gets endpoint URL for CRUD of the the given component's code.
 *
 * Note: `appComponentType` === `app` is the special name for the app-level code (like readme, base, common, ...)
 */
export function getCodeApiUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}: {
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType | 'app',
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment
}): string {
	// Compose directory structure
	let urn = `/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}${(environment.version !== 2) ? '/' + appName : ''}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(appComponentType)) {
		urn += `${(environment.version === 2) ? '/' + appName : ''}/${appVersion}`;
	}

	// Complete the URN by the type of item
	switch (appComponentType) {
		case "connection":
		case "webhook":
		case "module":
		case "rpc":
		case "function":
			urn += `/${appComponentType}s/${appComponentName}/${codeName}`;
			break;
		// Base, common, readme, group
		case "app":
			// Prepared for more app-level codes
			switch (codeName) {
				case "content":
					urn += `/readme`;
					break;
				default:
					urn += `/${codeName}`;
					break;
			}
			break;
		default:
			throw new Error(`Unsupported component type: ${appComponentType} by getEndpointUrl().`);
	}
	return 'https://' + environment.url + '/v2' + urn;
}


export async function uploadSource({appName, appVersion, appComponentType, appComponentName, codeName, environment, sourcePath}: {
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType | 'app',
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment,
	sourcePath: vscode.Uri,
}): Promise<void> {
		const codeDef = (appComponentType === 'app')
			? getAppCodeDefinition(codeName as AppCodeName)
			: getAppComponentCodeDefinition(appComponentType, codeName);

		const sourceContentUint8 = await vscode.workspace.fs.readFile(sourcePath);
		const sourceContent = new TextDecoder().decode(sourceContentUint8);

		// Get the code from the API
		const axiosConfig: AxiosRequestConfig = {
			url: getCodeApiUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}),
			method: "PUT",
			headers: {
				'Authorization': 'Token ' + environment.apikey,
				'Content-Type': codeDef.mimetype,
				// TODO 'x-imt-apps-sdk-version': Meta.version
			},
			data: sourceContent,
			transformRequest: (data) => (data),  // Do not expect the `data` to be JSON
		};
		await axios(axiosConfig);
}
