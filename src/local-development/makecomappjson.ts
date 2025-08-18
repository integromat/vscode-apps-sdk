import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import throat from 'throat';
import * as vscode from 'vscode';
import type { AppComponentMetadataWithCodeFiles, LocalAppOrigin, MakecomappJson } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { migrateMakecomappJsonFile } from './makecomappjson-migrations';
import { isComponentLocalIdValid } from './helpers/validate-id';
import { getOriginObject } from './helpers/get-origin-object';
import { entries } from '../utils/typed-object';
import { getCurrentWorkspace } from '../services/workspace';
import type { AppComponentType } from '../types/app-component-type.types';
import { MakecomappJsonFile } from './helpers/makecomapp-json-file-class';
import { isNotOwnedByApp } from './align-components-mapping';
import { Checksum } from './types/checksum.types';

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

	// Validate all compoments local ID
	for (const [componentType, components] of entries(makecomappJson.components)) {
		for (const componentID of Object.keys(components)) {
			if (!isComponentLocalIdValid(componentType, componentID)) {
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
export async function updateMakecomappJson(
	anyProjectPath: vscode.Uri,
	newMakecomappJson: MakecomappJson,
): Promise<void> {
	const makecomappRootdir = getMakecomappRootDir(anyProjectPath);
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	await vscode.workspace.fs.writeFile(
		makecomappJsonPath,
		new TextEncoder().encode(JSON.stringify(newMakecomappJson, null, 4)),
	);
}

/**
 * Insert or update the component into `makecomapp.json` file.
 * Adds/updates also the component ID-mapping.
 */
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	componentLocalId: string,
	remoteComponentName: string,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
	originChecksums: Checksum | null,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	componentLocalId: string,
	remoteComponentName: null,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: null,
	originChecksums: Checksum | null,
): Promise<void>;
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	componentLocalId: string,
	remoteComponentName: string | null,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin | null,
	originChecksums: Checksum | null,
): Promise<void> {
	// Input parameters check.
	if ((remoteComponentName !== null && origin === null) || (remoteComponentName === null && origin !== null)) {
		throw new Error(
			'Error in upsertComponentInMakecomappjson(): parameters `remoteComponentName` and `origin` should be both filled od boh null.',
		);
	}

	await limitConcurrency(async () => {
		const makecomappJson = await MakecomappJsonFile.fromLocalProject(anyProjectPath);

		// Validate `connection` and `altConnection` reference in component metadata is defined in local ID in "idMapping"
		if (['connection', 'rpc', 'module'].includes(componentType)) {
			if (componentMetadata.connection) {
				// Validate `connection` reference for being available in id mapping.
				const connectionExists = makecomappJson.content.origins.some((origin) =>
					origin?.idMapping?.connection.some(
						(idMappingItem) => idMappingItem.local === componentMetadata.connection,
					),
				);
				if (origin && !connectionExists) {
					throw new Error(
						`Cannot save ${componentType} "${componentLocalId}" in "makecomapp.json", because the "connection" reference "${
							componentMetadata.connection
						}" is not defined in "idMapping" in origin "${origin?.label ?? origin?.appId}".`,
					);
				}
			}
			if (componentMetadata.altConnection) {
				// Validate `connection` reference for being available in id mapping.
				const connectionExists = makecomappJson.content.origins.some((origin) =>
					origin?.idMapping?.connection.some(
						(idMappingItem) => idMappingItem.local === componentMetadata.altConnection,
					),
				);
				if (origin && !connectionExists) {
					throw new Error(
						`Cannot save ${componentType} "${componentLocalId}" in "makecomapp.json", because the "altConnection" reference "${
							componentMetadata.altConnection
						}" is not defined in "idMapping" in origin "${origin?.label ?? origin?.appId}".`,
					);
				}
			}
		}

		makecomappJson.content.components[componentType][componentLocalId] = componentMetadata;

		// Add origin->idMapping to { local: internalComponentId: remote: remoteComponentName }
		if (origin && remoteComponentName) {
			makecomappJson.getComponentIdMappingHelper(origin).addComponentIdMapping(
				componentType,
				componentLocalId,
				remoteComponentName,
				originChecksums ? isNotOwnedByApp(remoteComponentName, componentType, originChecksums) : false, // while new component is being created, it is not owned by the app
			);
		}

		await makecomappJson.saveChanges();
	});
}

export async function addEmptyOriginInMakecomappjson(anyProjectPath: vscode.Uri): Promise<LocalAppOrigin> {
	return await limitConcurrency(async () => {
		const makecomappJson = await getMakecomappJson(anyProjectPath);
		const newOrigin: LocalAppOrigin = {
			label: '-FILL-ME- - Example: Testing App ' + Math.floor(Math.random() * 1000),
			appId: '-FILL-ME- - Place here the app ID of an existing app, or create a new app and copy the app ID here',
			baseUrl:
				'-FILL-ME- - Example: https://eu1.make.com/api - Note: need to select the correct zone eu1, eu2, us1, us2, etc.',
			appVersion: 1,
			apikeyFile:
				(makecomappJson.origins[0]?.apikeyFile ?? '../secrets/apikey') +
				' - OR FILL AND CREATE ANOTHER NEW FILE',
		};
		makecomappJson.origins.push(newOrigin);
		await updateMakecomappJson(anyProjectPath, makecomappJson);
		return newOrigin;
	});
}

/**
 * Adds/edit component ID-mapping.
 */
export async function addComponentIdMapping(
	componentType: AppComponentType,
	internalComponentId: string | null,
	remoteComponentName: string | null,
	nonOwnedByApp: boolean,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
) {
	return await limitConcurrency(async () => {
		const makecomappJson = await MakecomappJsonFile.fromLocalProject(anyProjectPath);
		makecomappJson
			.getComponentIdMappingHelper(origin)
			.addComponentIdMapping(componentType, internalComponentId, remoteComponentName, nonOwnedByApp);
		await makecomappJson.saveChanges();
	});
}

/**
 * Generates the new component local ID, which can be used in `makecomapp.json` file for new component added in future.
 * There is guarantee that the returned local ID is not used yet.
 * The generated local ID is also reserved by adding it to makecomapp.json as empty component (= component metadata is `null`).
 * There is expectation that parent function will continue to finalize the component by adding component metadata (or abort the reservation).
 * @return Component ID.
 */
export async function generateAndReserveComponentLocalId(
	componentType: AppComponentType,
	preferredComponentLocalId: string,
	anyProjectPath: vscode.Uri,
): Promise<string> {
	return await limitConcurrency(async () => {
		const componentInternalId = await _generateComponentLocalId(
			componentType,
			preferredComponentLocalId,
			anyProjectPath,
			undefined,
		);
		const makecomappJson = await getMakecomappJson(anyProjectPath);

		makecomappJson.components[componentType][componentInternalId] = null;
		// Explanation: `null` is filled there only for a short time as "local ID reserved".

		await updateMakecomappJson(anyProjectPath, makecomappJson);

		return componentInternalId;
	});
}

/**
 * Returns the new free/unused local component ID, which can be used in makecomapp.json file.
 *
 * @param preferedComponentLocalId - Optional parameter (empty === ''). If provided, then new component ID will be tried to create with this ID.
 *
 * @private Shared alghoritm for other module's functions.
 *          Do not use directly anywhere without wrapper "limitConcurrency()".
 */
async function _generateComponentLocalId(
	componentType: AppComponentType,
	preferedComponentLocalId: string,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin | undefined,
): Promise<string> {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const originInMakecomappJson = origin && getOriginObject(makecomappJson, origin);

	let componentLocalIdPrefix: string = preferedComponentLocalId;
	let componentUnusedIndex: number | undefined; // `undefined` means empty.

	// If no requested component local ID, then use ID `[connectionType]1`.
	if (!preferedComponentLocalId) {
		componentLocalIdPrefix = componentType;
		componentUnusedIndex = 1;
	}

	/*
	 * Minor component naming improvement:
	 *
	 * These component types has Autogenerated ID. It means the naming convention in remote is strictly
	 * in format `[appId][index|'']`. If requested component local ID is in this format, then `[appId]` will be removed
	 * by this alghoritm and the more generic value `[connectionType][index]` will be used instead.
	 *
	 * It is here for better readibility of `makecomapp.json`'s components.
	 */
	if (['connection', 'webhook'].includes(componentType) && componentLocalIdPrefix !== componentType) {
		// Detect the `appId` usage in `requestedComponentLocalId`.
		const probableOrigins = makecomappJson.origins.filter(
			(origin) => origin?.appId && preferedComponentLocalId.startsWith(origin.appId),
		);
		if (probableOrigins.length === 1) {
			const componentPostfix = preferedComponentLocalId.substring(probableOrigins[0].appId.length);
			if (componentPostfix === '') {
				// Replace `appId` by `connectionType` of first component ( = has no index number)
				componentLocalIdPrefix = componentType;
				componentUnusedIndex = 1;
			} else if (/^[0-9]{1,2}$/.test(componentPostfix)) {
				// Replace `appId` by `connectionType` of second and further components ( = has index >= 2)
				componentLocalIdPrefix = componentType;
				componentUnusedIndex = Number.parseInt(componentPostfix, 10);
			}
		}
	}

	// Step 2: If the component with same index already exists, increment the index to first free one
	// Note: Here is the hack, that local component can be not filled fully, but is `null`.
	//       In this case it is reserved for some future use and consider it also as already used.
	while (
		makecomappJson.components[componentType][`${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`] !==
			undefined ||
		originInMakecomappJson?.idMapping?.[componentType].find(
			(idMappingItem) => idMappingItem.local === `${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`,
		)
	) {
		componentUnusedIndex = (componentUnusedIndex ?? 1) + 1;
	}

	// "Register" new component internal id (add it into `idMapping`).
	const componentInternalId = `${componentLocalIdPrefix}${componentUnusedIndex ?? ''}`;
	return componentInternalId;
}
