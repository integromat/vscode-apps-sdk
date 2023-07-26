import { AppsSdkConfigurationEnvironment } from "../providers/configuration";
import { Environment } from "../types/environment.types";
import * as Core from "../Core";
import { writeFile } from "async-file";
import axios from "axios";
import path from "path";
import { mkdir } from "fs/promises";

/**
 * Download the code from the API and save it to the local destination
 * @return void, because the code is saved to the destination file.
 * @param codeName
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function downloadSource(
	appName: string,
	appVersion: number,
	appComponentType: string,  // MUST BE PLURAL, like "modules", "functions", ...  !!!
	appComponentName: string,
	codeName: string,
	environment: AppsSdkConfigurationEnvironment,
	destinationPath: string,
): Promise<void> {
	// Compose directory structure
	let urn = `/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}${(environment.version !== 2) ? `/${appName}` : ''}`;
	let urnForFile = `/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}/${appName}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(appComponentType)) {
		urn += `${(environment.version === 2) ? `/${appName}` : ''}/${appVersion}`;
		urnForFile += `/${appVersion}`;
	}

	// Complete the URN by the type of item
	switch (appComponentType) {
		case "function":
		case "functions":
		case "rpc":
		case "rpcs":
		case "module":
		case "modules":
		case "connection":
		case "connections":
		case "webhook":
		case "webhooks":
			urn += `/${appComponentType}/${appComponentName}/${codeName}`;
			urnForFile += `/${appComponentType}/${appComponentName}/${codeName}`;
			break;
		case "app":
		case "apps":
			// Prepared for more app-level codes
			switch (codeName) {
				case "content":
					urn += `/readme`;
					urnForFile += `/readme`;
					break;
				default:
					urn += `/${codeName}`;
					urnForFile += `/${codeName}`;
					break;
			}
			break;
	}

	// Get the code from the API
	const axiosResponse = await axios({
		url: 'https://' + environment.url + '/v2' + urn,
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
