import * as path from 'node:path';
import { AxiosRequestConfig } from 'axios';
import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { AppComponentMetadataWithCodeFiles, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { ApiCodeType, CodeType, ComponentCodeType, GeneralCodeType } from './types/code-type.types';
import { CodeDef } from './types/code-def.types';
import { getComponentApiUrl } from './helpers/api-url';
import { getAppComponentCodeDefinition, getGeneralCodeDefinition } from '../services/component-code-def';
import { AppComponentType, AppGeneralType } from '../types/app-component-type.types';
import { log } from '../output-channel';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { entries } from '../utils/typed-object';
import { version as ExtensionVersion } from '../Meta';
import { sendTelemetry } from '../utils/telemetry';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { getMakecomappJson, updateMakecomappJson } from './makecomappjson';

/**
 * Download code from the Make API and save it to the local destination
 *
 * Note: If `appComponentType` === 'app' => remoteComponentName must be ''.
 *
 * @return void, because the code is saved to the destination file.
 * @param codeType
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function pullComponentCode({
	appComponentType,
	remoteComponentName,
	codeType,
	origin,
	destinationPath,
}: {
	appComponentType: AppComponentType | AppGeneralType;
	remoteComponentName: string;
	codeType: CodeType;
	origin: LocalAppOriginWithSecret;
	destinationPath: vscode.Uri;
}): Promise<void> {
	log('debug', `Pull ${appComponentType} ${remoteComponentName}: code ${codeType}`);

	sendTelemetry('pull_component_code', { appComponentType, remoteComponentName });

	progresDialogReport(`Pulling ${appComponentType} ${remoteComponentName} code ${codeType}`);

	const codeContent = await downloadComponentCode({
		appComponentType,
		remoteComponentName,
		codeType,
		origin,
	});

	// Save the received code to the temp directory
	const codeContentUint8 = new TextEncoder().encode(codeContent);
	await vscode.workspace.fs.writeFile(destinationPath, codeContentUint8);

	progresDialogReport('');
}

/**
 * Download an code from the Make API.
 *
 * Note: If `appComponentType` === 'app' => remoteComponentName must be ''.
 *
 * @return component code content
 * @param codeType
 *   - 	For module: api, parameteres, expect, interface, samples, scope
 */
export async function downloadComponentCode({
	appComponentType,
	remoteComponentName,
	codeType,
	origin,
}: {
	appComponentType: AppComponentType | AppGeneralType;
	remoteComponentName: string;
	codeType: CodeType;
	origin: LocalAppOriginWithSecret;
}): Promise<string> {
	const codeDef = getCodeDef(appComponentType, codeType);

	// Get the code from the API
	let codeContent = await requestMakeApi<string>({
		url: getCodeApiUrl({ appComponentType, remoteComponentName, apiCodeType: codeDef.apiCodeType, origin }),
		headers: {
			Authorization: 'Token ' + origin.apikey,
			'imt-vsce-localmode': 'true',
			'imt-apps-sdk-version': ExtensionVersion,
		},
		transformResponse: (res) => res, // Do not parse the response into JSON
	});

	// Prepare a stream to be saved

	// Fix null value -- DON'T FORGET TO CHANGE IN IMPORT WHEN CHANGING THIS
	// Happends on legacy Integromat only, where DB null value is directly returned without filling the default value "{}"|"[]"
	if (codeContent === 'null') {
		if (codeType === 'samples') {
			codeContent = '{}';
		} else {
			codeContent = '[]';
		}
	}

	// Special improvement:
	//   Add the code comment into module scope if code is empty.
	const isEmptyArrayTest = /^\s*\[\s*\]\s*$/;
	if (appComponentType === 'module' && codeType === 'scope' && isEmptyArrayTest.test(codeContent)) {
		codeContent =
			'// Code below is relevant only if an OAuth type connection is associated with the module. In other cases, it is ignored.\n' +
			codeContent;
	}

	return codeContent;
}

/**
 * Gets endpoint URL for CRUD of the the given component's code.
 * Note: `appComponentType` === `app` is the special name for the app-level code (like readme, base, common, ...)
 * @private
 */
export function getCodeApiUrl({
	appComponentType,
	remoteComponentName,
	apiCodeType,
	origin,
}: {
	appComponentType: AppComponentType | 'app';
	remoteComponentName: string;
	apiCodeType: ApiCodeType;
	origin: LocalAppOriginWithSecret;
}): string {
	const componentUrl = getComponentApiUrl({ componentType: appComponentType, remoteComponentName, origin });

	if (appComponentType === 'app' && apiCodeType === 'content') {
		return `${componentUrl}/readme`;
	} else {
		return `${componentUrl}/${apiCodeType}`;
	}
}

export async function deployComponentCode({
	appComponentType,
	remoteComponentName,
	codeType,
	origin,
	sourcePath,
}: {
	appComponentType: AppComponentType | 'app';
	remoteComponentName: string;
	codeType: CodeType;
	origin: LocalAppOriginWithSecret;
	sourcePath: vscode.Uri;
}): Promise<void> {
	progresDialogReport(
		`Deploying file ${path.basename(sourcePath.fsPath)} to origin ${
			origin.label ?? origin.appId
		} -> ${appComponentType} ${remoteComponentName} -> code ${codeType}`,
	);

	sendTelemetry('deploy_component_code', { appComponentType, remoteComponentName });

	const codeDef = getCodeDef(appComponentType, codeType);

	try {
		await vscode.workspace.fs.stat(sourcePath);
	} catch (e: any) {
		if (e.code === 'FileNotFound') {
			throw new Error('Skipped code deployment, because local file is missing.');
		} else {
			// Unknown error
			throw e;
		}
	}
	const sourceContentUint8 = await vscode.workspace.fs.readFile(sourcePath);
	const sourceContent = new TextDecoder().decode(sourceContentUint8);

	// Get the code from the API
	const axiosConfig: AxiosRequestConfig = {
		url: getCodeApiUrl({ appComponentType, remoteComponentName, apiCodeType: codeDef.apiCodeType, origin }),
		method: 'PUT',
		headers: {
			Authorization: 'Token ' + origin.apikey,
			'Content-Type': codeDef.mimetype,
			'imt-vsce-localmode': 'true',
			'imt-apps-sdk-version': ExtensionVersion,
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

/**
 * Pulls all files of component specified in `componentMetadata.codeFiles`
 * from remote origin to local file system.
 */
export async function pullComponentCodes(
	appComponentType: AppComponentType,
	remoteComponentName: string,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	componentMetadata: AppComponentMetadataWithCodeFiles,
): Promise<void> {
	log('debug', `Pull ${appComponentType} ${remoteComponentName}: all codes`);

	sendTelemetry('pull_component_codes', { appComponentType, remoteComponentName });

	// Pulling when there are undeployed changes. Override them and align the state with the origin.
	const makecomappJson = await getMakecomappJson(localAppRootdir);
	const componentIdMappingHelper = new ComponentIdMappingHelper(makecomappJson, origin);
	componentIdMappingHelper.filterMappingItems(item => !item?.localDeleted);
	await updateMakecomappJson(localAppRootdir, makecomappJson);

	// Download codes from API to local files
	for (const [codeType, codeFilePath] of entries(componentMetadata.codeFiles)) {
		if (codeFilePath === null) {
			// Skip the ignored component code
			continue;
		}
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeFilePath);
		await pullComponentCode({
			appComponentType,
			remoteComponentName,
			codeType,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}
}
