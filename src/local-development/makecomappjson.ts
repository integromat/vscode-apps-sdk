import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import throat from 'throat';
import * as vscode from 'vscode';
import { AppComponentMetadataWithCodeFiles, LocalAppOrigin, MakecomappJson } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { migrateMakecomappJsonFile } from './makecomappjson-migrations';
import { isValidID } from './helpers/validate-id';
import { getOriginObject } from './helpers/get-origin-object';
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
	componentLocalId: string,
	remoteComponentName: string,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	componentLocalId: string,
	remoteComponentName: null,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: null,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	componentLocalId: string,
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
		makecomappJson.components[componentType][componentLocalId] = componentMetadata;

		// Add origin->idMapping to { local: internalComponentId: remote: remoteComponentName }
		if (origin && remoteComponentName) {
			await _addComponentIdMapping(componentType, componentLocalId, remoteComponentName, anyProjectPath, origin);
		}

		await updateMakecomappJson(anyProjectPath, makecomappJson);
	});
}

export async function addComponentIdMapping(
	componentType: AppComponentType,
	internalComponentId: string | null,
	remoteComponentName: string | null,
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
	componentLocalId: string | null,
	remoteComponentName: string | null,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
) {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const originInMakecomappJson = getOriginObject(makecomappJson, origin);
	const existingIdMappingItems = originInMakecomappJson.idMapping[componentType].filter(
		(idMappingItem) =>
			(idMappingItem.local !== null && idMappingItem.local === componentLocalId) ||
			(idMappingItem.remote !== null && idMappingItem.remote === remoteComponentName),
	);
	if (existingIdMappingItems.length > 0) {
		// Mapping already exists. Check the consistency of the pair.
		if (existingIdMappingItems.length > 1) {
			throw new Error(
				`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where mismatch found for local=${componentLocalId}, remote=${remoteComponentName}.`,
			);
		} else if (
			existingIdMappingItems[0].local !== componentLocalId ||
			existingIdMappingItems[0].remote !== remoteComponentName
		) {
			throw new Error(
				`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where found local=${componentLocalId} or remote=${remoteComponentName}, but it is paired with another unexpected component ID.`,
			);
		}
	} else {
		// Create new ID mapping, because does not exist yet.
		originInMakecomappJson.idMapping[componentType].push({
			local: componentLocalId,
			remote: remoteComponentName,
		});
	}

	// Save updated makecomapp.json file
	await updateMakecomappJson(anyProjectPath, makecomappJson);
}

export async function generateAndReserveComponentInternalId(
	componentType: AppComponentType,
	expectedRemoteComponentId: string,
	anyProjectPath: vscode.Uri,
): Promise<string> {
	return await limitConcurrency(async () => {
		const componentInternalId = await _generateComponentLocalId(
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
async function _generateComponentLocalId(
	componentType: AppComponentType,
	expectedRemoteComponentId: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin | undefined,
): Promise<string> {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const originInMakecomappJson = origin && getOriginObject(makecomappJson, origin);

	let componentLocalIdPrefix: string;
	let componentUnusedIndex: number | undefined; // `undefined` means empty.

	switch (componentType) {
		case 'connection':
		case 'rpc':
		case 'webhook': {
			// Autogenerated ID
			// Explanation: Some component ID (like connections and may be some other kind of components)
			//              have naming convention as [appId][index].
			componentLocalIdPrefix = componentType;
			componentUnusedIndex = 1;

			// Step 1: Try to isolate the number from end of original ID
			const probableOrigins = makecomappJson.origins.filter(
				(origin) => origin?.appId && expectedRemoteComponentId.startsWith(origin.appId),
			);
			if (probableOrigins.length === 1) {
				const componentPostfix = expectedRemoteComponentId.substring(probableOrigins[0].appId.length);
				if (/^[0-9]{1,2}$/.test(componentPostfix)) {
					componentUnusedIndex = Number.parseInt(
						componentPostfix,
						10,
					);
				}
			}
			break;
		}
		default:
			// Node: module's and function's IDs are specified by user. Do not change it in local.
			componentLocalIdPrefix = expectedRemoteComponentId;
	}

	// Step 2: If the component with same index already exists, increment the index to first free one
	// Note: Here is the hack, that local component can be not filled fully, but is `null`.
	//       In this case it is reserved for some future use and consider it also as already used.
	while (
		makecomappJson.components[componentType][`${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`] !==
			undefined ||
		originInMakecomappJson?.idMapping[componentType].find(
			(idMappingItem) => idMappingItem.local === `${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`,
		)
	) {
		componentUnusedIndex = (componentUnusedIndex ?? 1) + 1;
	}

	// "Register" new component internal id (add it into `idMapping`).
	const componentInternalId = `${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`;
	return componentInternalId;
}
