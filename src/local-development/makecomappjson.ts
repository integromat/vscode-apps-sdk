import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import throat from 'throat';
import * as vscode from 'vscode';
import { AppComponentMetadataWithCodeFiles, LocalAppOrigin, MakecomappJson } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { migrateMakecomappJsonFile } from './makecomappjson-migrations';
import { isValidID } from './helpers/validate-id';
import { getCurrentWorkspace } from '../services/workspace';
import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';

const limitConcurrency = throat(1);

/**
 * Finds the nearest parent dir, where makecomapp.json is located.
 * File must be located in the workspace.
 * @return Directory, where makecomapp.json is located.
 */
export function getMakecomappRootDir(anyProjectPath: vscode.Uri): vscode.Uri {
	const workspace = getCurrentWorkspace();
	let currentProjectPath = anyProjectPath;
	let currentDirRelative: string;
	const errorMessage = `Appropriate ${MAKECOMAPP_FILENAME} file not found in the opened folder/workspace. The path "${path.posix.relative(
		workspace.uri.path,
		anyProjectPath.path,
	)}" is not a part of a Make App.`;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		currentDirRelative = path.posix.relative(workspace.uri.path, currentProjectPath.path);
		if (currentDirRelative.startsWith('..')) {
			throw new Error(errorMessage);
		}
		if (existsSync(path.join(currentProjectPath.fsPath, MAKECOMAPP_FILENAME))) {
			return currentProjectPath;
		}
		if (currentDirRelative === '' || currentProjectPath.fsPath === path.parse(currentProjectPath.fsPath).root) {
			throw new Error(errorMessage);
		}
		currentProjectPath = vscode.Uri.joinPath(currentProjectPath, '..');
	}
}

/**
 * Gets makecomapp.json content from the nearest parent dir, where makecomapp.json is located.
 */
export async function getMakecomappJson(anyProjectPath: vscode.Uri): Promise<MakecomappJson> {
	const makecomappRootdir = getMakecomappRootDir(anyProjectPath);
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	let makecomappJsonRaw: string;
	try {
		makecomappJsonRaw = new TextDecoder().decode(await vscode.workspace.fs.readFile(makecomappJsonPath));
	} catch (e: any) {
		const err = new Error(`Cannot read the file "${MAKECOMAPP_FILENAME}."`, { cause: e });
		err.name = 'PopupError';
		throw err;
	}
	let makecomappJson: MakecomappJson;
	try {
		makecomappJson = JSON.parse(makecomappJsonRaw);
	} catch (e: any) {
		const err = new Error(
			`Check the "${MAKECOMAPP_FILENAME}" file, which is currupted. It is not valid JSON file, there is some syntax error."`,
			{ cause: e },
		);
		err.name = 'PopupError';
		throw err;
	}
	if (!Array.isArray(makecomappJson.origins)) {
		const err = new Error(`Missing "origins" in ${MAKECOMAPP_FILENAME}, or it has incorrect type.`);
		err.name = 'PopupError';
		throw err;
	}

	// Finds all deprecated properties and upgrade it to valid
	const upgraded = migrateMakecomappJsonFile(makecomappJson);
	if (upgraded.changesApplied) {
		// Save the upgrade back to the `makecomapps.json`
		await updateMakecomappJson(anyProjectPath, upgraded.makecomappJson);
	}

	// Validate all compoments ID
	for (const [componentType, components] of entries(makecomappJson.components)) {
		for (const componentID of Object.keys(components)) {
			if (!isValidID(componentType, componentID)) {
				const e = new Error(
					`${componentType} ID "${componentID}" defined in ${MAKECOMAPP_FILENAME} file is not valid ID. It does not meet requirements. Fix it first.`,
				);
				e.name = 'PopupError';
				throw e;
			}
		}
	}

	// TODO To add the JSON schema validation here.

	return upgraded.makecomappJson;
}

/**
 * Writes new content into `makecomapp.json` file.
 */
async function updateMakecomappJson(anyProjectPath: vscode.Uri, newMakecomappJson: MakecomappJson): Promise<void> {
	const makecomappRootdir = getMakecomappRootDir(anyProjectPath);
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	await vscode.workspace.fs.writeFile(
		makecomappJsonPath,
		new TextEncoder().encode(JSON.stringify(newMakecomappJson, null, 4)),
	);
}

/**
 * Insert or update the component in makecomapp.json file.
 */
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	internalComponentId: string,
	remoteComponentName: string,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	internalComponentId: string,
	remoteComponentName: null,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: null,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	internalComponentId: string,
	remoteComponentName: string | null,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin | null,
): Promise<void> {
	// Input parameters check.
	if ((remoteComponentName !== null && origin === null) || (remoteComponentName === null && origin !== null)) {
		throw new Error(
			'Error in upsertComponentInMakecomappjson(): parameters `remoteComponentName` and `origin` should be both filled od boh null.',
		);
	}

	await limitConcurrency(async () => {
		const makecomappJson = await getMakecomappJson(anyProjectPath);
		makecomappJson.components[componentType][internalComponentId] = componentMetadata;

		// Add origin->idMapping to { local: internalComponentId: remote: remoteComponentName }
		if (origin && remoteComponentName) {
			await _addComponentIdMapping(
				componentType,
				internalComponentId,
				remoteComponentName,
				anyProjectPath,
				origin,
			);
		}

		await updateMakecomappJson(anyProjectPath, makecomappJson);
	});
}

export async function addComponentIdMapping(
	componentType: AppComponentType,
	internalComponentId: string,
	remoteComponentName: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
) {
	return await limitConcurrency(async () => {
		return _addComponentIdMapping(componentType, internalComponentId, remoteComponentName, anyProjectPath, origin);
	});
}

/**
 * @private Do not use directly. Need to be wrapped by `limitConcurrency()` in parent method.
 */
async function _addComponentIdMapping(
	componentType: AppComponentType,
	internalComponentId: string,
	remoteComponentName: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
) {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const originInMakecomappJson = getOriginObject(makecomappJson, origin);
	const existingIdMappingItems = originInMakecomappJson.idMapping[componentType].filter(
		(idMappingItem) => idMappingItem.local === internalComponentId || idMappingItem.remote === remoteComponentName,
	);
	if (existingIdMappingItems.length > 0) {
		// Mapping already exists. Check the consistency of the pair.
		if (existingIdMappingItems.length > 1) {
			throw new Error(
				`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where mismatch found for local=${internalComponentId}, remote=${remoteComponentName}.`,
			);
		} else if (
			existingIdMappingItems[0].local !== internalComponentId ||
			existingIdMappingItems[0].remote !== remoteComponentName
		) {
			throw new Error(
				`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where found local=${internalComponentId} or remote=${remoteComponentName}, but it is paired with another unexpected component ID.`,
			);
		}
	} else {
		// Create new ID mapping, because does not exist yet.
		originInMakecomappJson.idMapping[componentType].push({
			local: internalComponentId,
			remote: remoteComponentName,
		});
	}

	// Save updated makecomapp.json file
	await updateMakecomappJson(anyProjectPath, makecomappJson);
}

/**
 * Generates and returns a new component internal ID, which is not used yet in `makecomapp.json`.
 * If existing component internal ID is defined for remote component name, the existing is returned.
 *
 * Detailed explanation:
 *
 * Internal ID is used in `makecomapp.json` only referencing inside this file only.
 * It means these internal IDs are converted to actual component ID before pull/deploy commands based on mapping defined
 * in makecomapp.json -> origin[] -> idMapping -> {componentType}
 * */
export async function remoteComponentNameToInternalId(
	componentType: AppComponentType,
	remoteComponentName: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
): Promise<string> {
	return await limitConcurrency(async () => {
		const makecomappJson = await getMakecomappJson(anyProjectPath);
		const originInMakecomappJson = getOriginObject(makecomappJson, origin);

		const matchedMapping = originInMakecomappJson.idMapping[componentType].find(
			(idMappingItem) => idMappingItem.remote === remoteComponentName,
		);
		if (matchedMapping) {
			// Mapping already exist. No need anything special. Return existing.
			return matchedMapping.local;
		}

		const componentInternalId = await _generateComponentInternalId(
			componentType,
			remoteComponentName,
			anyProjectPath,
			origin,
		);
		originInMakecomappJson.idMapping[componentType].push({
			local: componentInternalId,
			remote: remoteComponentName,
		});

		// Save updated makecomapp.json file
		await updateMakecomappJson(anyProjectPath, makecomappJson);

		return componentInternalId;
	});
}

export function getLocalIdToRemoteComponentNameMapping(
	componentType: AppComponentType,
	makecomappJson: MakecomappJson,
	origin: LocalAppOrigin,
): Record<string, string> {
	const originInMakecomappJson = getOriginObject(makecomappJson, origin);

	const mapping = originInMakecomappJson.idMapping[componentType].reduce((obj, idMappingItem) => {
		obj[idMappingItem.local] = idMappingItem.remote;
		return obj;
	}, {} as Record<string, string>);
	return mapping;
}

export async function generateAndReserveComponentInternalId(
	componentType: AppComponentType,
	expectedRemoteComponentId: string,
	anyProjectPath: vscode.Uri,
): Promise<string> {
	return await limitConcurrency(async () => {
		const componentInternalId = await _generateComponentInternalId(
			componentType,
			expectedRemoteComponentId,
			anyProjectPath,
			undefined,
		);
		const makecomappJson = await getMakecomappJson(anyProjectPath);

		makecomappJson.components[componentType][componentInternalId] = null as any;
		// Note: The `null` is not officially available value for that interface, but the null is filled there only for a short time, so using this hack.

		await updateMakecomappJson(anyProjectPath, makecomappJson);

		return componentInternalId;
	});
}

/**
 * Returns the new free/unused local component ID, which can be used in makecomapp.json file.
 *
 * @private Shared alghoritm for other module's functions.
 *          Do not use directly anywhere without wrapper "limitConcurrency()".
 */
async function _generateComponentInternalId(
	componentType: AppComponentType,
	expectedRemoteComponentId: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin | undefined,
): Promise<string> {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const originInMakecomappJson = origin && getOriginObject(makecomappJson, origin);

	let componenInternalIdPrefix: string;
	let componentUnusedIndex: number | undefined; // `undefined` means empty.

	switch (componentType) {
		case 'connection':
		case 'rpc':
		case 'webhook': {
			// Autogenerated ID
			// Explanation: Some component ID (like connections and may be some other kind of components)
			//              have naming convention as [appId][index].
			componenInternalIdPrefix = componentType;
			componentUnusedIndex = 1;

			// Step 1: Try to isolate the number from end of original ID
			if (originInMakecomappJson?.appId && expectedRemoteComponentId.startsWith(originInMakecomappJson.appId)) {
				// Note: This condition should be matched every time
				componentUnusedIndex = Number.parseInt(
					expectedRemoteComponentId.substring(originInMakecomappJson.appId.length) || '1',
					10,
				);
			}
			break;
		}
		default:
			// Node: module's and function's IDs are specified by user. Do not change it in local.
			componenInternalIdPrefix = expectedRemoteComponentId;
	}

	// Step 2: If the component with same index already exists, increment the index to first free one
	// Note: Here is the hack, that local component can be not filled fully, but is `null`.
	//       In this case it is reserved for some future use and consider it also as already used.
	while (
		makecomappJson.components[componentType][`${componenInternalIdPrefix}${componentUnusedIndex ?? ''}`] !==
			undefined ||
		originInMakecomappJson?.idMapping[componentType].find(
			(idMappingItem) => idMappingItem.local === `${componenInternalIdPrefix}${componentUnusedIndex ?? ''}`,
		)
	) {
		componentUnusedIndex = (componentUnusedIndex ?? 1) + 1;
	}

	// "Register" new component internal id (add it into `idMapping`).
	const componentInternalId = `${componenInternalIdPrefix}${componentUnusedIndex ?? ''}`;
	return componentInternalId;
}

/**
 * Returns the origin object freom makecomapp.json.
 * Used for editation this object for case, when input `origin` can be a clone of this object.
 */
function getOriginObject(makecomappJson: MakecomappJson, origin: LocalAppOrigin): LocalAppOrigin {
	const originInMakecomappJson = makecomappJson.origins.find((or) => compareOrigins(or, origin));
	if (!originInMakecomappJson) {
		throw new Error(
			'Internal error. System was not able to find the actually used origin in "makecomapp.json" file.',
		);
	}
	return originInMakecomappJson;
}

function compareOrigins(origin1: LocalAppOrigin, origin2: LocalAppOrigin): boolean {
	return (
		origin1.appId === origin2.appId &&
		origin1.appVersion === origin2.appVersion &&
		origin1.baseUrl === origin2.baseUrl
	);
}
