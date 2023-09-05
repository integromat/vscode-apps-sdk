import * as vscode from 'vscode';
import * as Core from '../Core';
import { AxiosRequestConfig } from 'axios';
import { getGeneralCodeDefinition, getAppComponentCodeDefinition } from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';
import { TextDecoder, TextEncoder } from 'util';
import { LocalAppOriginWithSecret } from './types/makecomapp.types';
import { log } from '../output-channel';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { CodeType, ComponentCodeType, GeneralCodeType, ApiCodeType } from './types/code-type.types';
import { CodeDef } from './types/code-def.types';

const ENVIRONMENT_VERSION = 2;

/**
 * Download the code from the API and save it to the local destination
 * @return void, because the code is saved to the destination file.
 * @param codeName
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function downloadSource({
	// TODO Rename downloadSource to pullSource
	appComponentType,
	appComponentName,
	codeName,
	origin,
	destinationPath,
}: {
	appComponentType: AppComponentType | 'app';
	appComponentName: string;
	codeName: CodeType;
	origin: LocalAppOriginWithSecret,
	destinationPath: vscode.Uri;
}): Promise<void> {
	log('debug', `Pull ${appComponentType} ${appComponentName}: code ${codeName}`);
	progresDialogReport(`Pulling ${appComponentType} ${appComponentName} code ${codeName}`);

	const codeDef = getCodeDef(appComponentType, codeName);

	// Get the code from the API
	let codeContent = await requestMakeApi({
		url: getCodeApiUrl({ appComponentType, appComponentName, codeName: codeDef.apiCodeType, origin }),
		headers: {
			Authorization: 'Token ' + origin.apikey,
		},
		transformResponse: (res) => res, // Do not parse the response into JSON
	});

	// Prepare a stream to be saved

	// Fix null value -- DON'T FORGET TO CHANGE IN IMPORT WHEN CHANGING THIS
	// Happends on legacy Integromat only, where DB null value is directly returned without filling the default value "{}"|"[]"
	if (codeContent === 'null') {
		if (codeName === 'samples') {
			codeContent = '{}';
		} else {
			codeContent = '[]';
		}
	}

	// Save the received code to the temp directory
	const codeContentUint8 = new TextEncoder().encode(codeContent);
	await vscode.workspace.fs.writeFile(destinationPath, codeContentUint8);
	progresDialogReport('');
}

/**
 * Gets endpoint URL for CRUD of the the given component's code.
 * Note: `appComponentType` === `app` is the special name for the app-level code (like readme, base, common, ...)
 * @private
 */
function getCodeApiUrl({
	appComponentType,
	appComponentName,
	codeName,
	origin,
}: {
	appComponentType: AppComponentType | 'app';
	appComponentName: string;
	codeName: ApiCodeType;
	origin: LocalAppOriginWithSecret;
}): string {
	// Compose directory structure
	let urn = `/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(ENVIRONMENT_VERSION, 'app')}${
		ENVIRONMENT_VERSION !== 2 ? '/' + origin.appId : ''
	}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(appComponentType)) {
		urn += `${ENVIRONMENT_VERSION === 2 ? '/' + origin.appId : ''}/${origin.appVersion}`;
	}

	// Complete the URN by the type of item
	switch (appComponentType) {
		case 'connection':
		case 'webhook':
		case 'module':
		case 'rpc':
		case 'function':
			urn += `/${appComponentType}s/${appComponentName}/${codeName}`;
			break;
		// Base, common, readme, group
		case 'app':
			// Prepared for more app-level codes
			switch (codeName) {
				case 'content':
					urn += '/readme';
					break;
				default:
					urn += `/${codeName}`;
					break;
			}
			break;
		default:
			throw new Error(`Unsupported component type: ${appComponentType} by getEndpointUrl().`);
	}
	return origin.baseUrl + '/v2' + urn;
}

export async function uploadSource({
	appComponentType,
	appComponentName,
	codeName,
	origin,
	sourcePath,
}: {
	appComponentType: AppComponentType | 'app';
	appComponentName: string;
	codeName: CodeType;
	origin: LocalAppOriginWithSecret;
	sourcePath: vscode.Uri;
}): Promise<void> {
	progresDialogReport(`Deploying ${appComponentType} ${appComponentName}: code ${codeName}`);

	const codeDef = getCodeDef(appComponentType, codeName);

	const sourceContentUint8 = await vscode.workspace.fs.readFile(sourcePath);
	const sourceContent = new TextDecoder().decode(sourceContentUint8);

	// Get the code from the API
	const axiosConfig: AxiosRequestConfig = {
		url: getCodeApiUrl({ appComponentType, appComponentName, codeName: codeDef.apiCodeType, origin }),
		method: 'PUT',
		headers: {
			Authorization: 'Token ' + origin.apikey,
			'Content-Type': codeDef.mimetype,
		},
		data: sourceContent,
		transformRequest: (data) => data, // Do not expect the `data` to be JSON
	};
	await requestMakeApi(axiosConfig);

	progresDialogReport('');
}

function getCodeDef(componentType: AppComponentType | 'app', codeType: CodeType): CodeDef {
	return componentType === 'app'
			? getGeneralCodeDefinition(codeType as GeneralCodeType)
			: getAppComponentCodeDefinition(componentType, codeType as ComponentCodeType);
}
