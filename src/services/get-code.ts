import * as vscode from 'vscode';
import { AppsSdkConfigurationEnvironment } from "../providers/configuration";
import { Environment } from "../types/environment.types";
import * as Core from "../Core";
import { writeFile } from "async-file";
import axios, { AxiosRequestConfig } from "axios";
import path from "path";
import { mkdir, readFile } from "fs/promises";
import { getAppComponentCodeDefinition } from "./component-code-def";
import { AppComponentType } from '../types/app-component-type.types';

/**
 * Download the code from the API and save it to the local destination
 * @return void, because the code is saved to the destination file.
 * @param codeName
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function downloadSource({appName, appVersion, appComponentType, appComponentName, codeName, environment, destinationPath}: {
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType,
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment,
	destinationPath: string,
}): Promise<void> {
	// Get the code from the API
	const axiosResponse = await axios({
		url: getEndpointUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}),
		headers: {
			'Authorization': 'Token ' + environment.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
		transformResponse: (res) => { return res; },  // Do not parse the response into JSON
	});

	// Prepare a stream to be saved
	let codeContent = axiosResponse.data;

	// Fix null value -- DON'T FORGET TO CHANGE IN IMPORT WHEN CHANGING THIS
	// Happends on legacy Integromat only, where DB null value is directly returned without filling the default value "{}"|"[]"
	if (codeContent === "null") {
		if (codeName === 'samples') {
			codeContent = '{}';
		} else {
			codeContent = '[]';
		}
	}

	// Create directory for file
	await mkdir(path.dirname(destinationPath), { recursive: true });

	// Save the received code to the temp directory
	await writeFile(destinationPath, codeContent);
}


/**
 * Gets endpoint URL for CRUD of the the given component's code.
 */
export function getEndpointUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}: {
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType,
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment
}): string {
	// Compose directory structure
	let urn = `/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}${(environment.version !== 2) ? `/${appName}` : ''}`;
	// let urnForFile = `/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}/${appName}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(appComponentType)) {
		urn += `${(environment.version === 2) ? `/${appName}` : ''}/${appVersion}`;
		// urnForFile += `/${appVersion}`;
	}

	// Complete the URN by the type of item
	switch (appComponentType) {
		// case "function":   // TODO Implementation is correct here, but type is not implemented yet in other places
		// case "rpc":   // TODO Implementation is correct here, but type is not implemented yet in other places
		case "module":
		// case "connection":   // TODO Implementation is correct here, but type is not implemented yet in other places
		// case "webhook":   // TODO Implementation is correct here, but type is not implemented yet in other places
			urn += `/${appComponentType}s/${appComponentName}/${codeName}`;
			// urnForFile += `/${appComponentType}/${appComponentName}/${codeName}`;
			break;
		case "app":
			// Prepared for more app-level codes
			switch (codeName) {
				case "content":
					urn += `/readme`;
					// urnForFile += `/readme`;
					break;
				default:
					urn += `/${codeName}`;
					// urnForFile += `/${codeName}`;
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
	appComponentType: AppComponentType,  // MUST BE PLURAL, like "modules", "functions", ...  !!!
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment,
	sourcePath: string,
}): Promise<void> {
		const codeDef = getAppComponentCodeDefinition(appComponentType, codeName);

		const sourceContent = await readFile(sourcePath, {encoding: 'utf-8'});

		// Get the code from the API
		const axiosConfig: AxiosRequestConfig = {
			url: getEndpointUrl({appName, appVersion, appComponentType, appComponentName, codeName, environment}),
			method: "PUT",
			headers: {
				'Authorization': 'Token ' + environment.apikey,
				'Content-Type': codeDef.mimetype,
				// TODO 'x-imt-apps-sdk-version': Meta.version
			},
			data: sourceContent,
			transformResponse: (res) => { return res; },  // Do not parse the response into JSON
		};
		await axios(axiosConfig);

		vscode.window.showInformationMessage(`Code ${codeName} of ${appComponentType} ${appComponentName} of ${appName} ${appVersion} succesfully deployed to Make.`);
}
