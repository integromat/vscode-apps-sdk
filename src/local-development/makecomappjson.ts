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
import { log } from '../output-channel';
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
 * Renames connection ID in makecomapp.json. Renames also all references of the connection.
 */
export async function renameConnectionInMakecomappJson(
	anyProjectPath: vscode.Uri,
	oldConnectionName: string,
	newConnectionName: string,
): Promise<void> {
	log('debug', `makecomapp.json: Rename connetion ${oldConnectionName} => ${newConnectionName}`);

	const makecomappJson = await getMakecomappJson(anyProjectPath);

	// Rename the connection itself
	const connections = makecomappJson.components.connection;
	const newConnections = Object.fromEntries(
		Object.entries(connections).map(([connectionName, connectionMetadata]) => {
			return [connectionName === oldConnectionName ? newConnectionName : connectionName, connectionMetadata];
		}),
	);
	makecomappJson.components.connection = newConnections;

	// Rename referecne: connections mentioned in modules
	Object.values(makecomappJson.components.module).forEach((moduleMetadata) => {
		if (moduleMetadata.connection === oldConnectionName) {
			moduleMetadata.connection = newConnectionName;
		}
		if (moduleMetadata.altConnection === oldConnectionName) {
			moduleMetadata.altConnection = newConnectionName;
		}
	});
	// Write changes to file
	await updateMakecomappJson(anyProjectPath, makecomappJson);
}

/**
 * Insert or update the component in makecomapp.json file.
 */
export async function upsertComponentInMakecomappjson(
	componentType: AppComponentType,
	remoteComponentName: string,
	internalComponentId: string,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
) {
	await limitConcurrency(async () => {
		const makecomappJson = await getMakecomappJson(anyProjectPath);
		makecomappJson.components[componentType][internalComponentId] = componentMetadata;

		// TODO Update origin -> idMapping to { local: internalComponentId: remote: remoteComponentName }

		await updateMakecomappJson(anyProjectPath, makecomappJson);
	});
}

export function getComponentInternalId(
	origin: LocalAppOrigin,
	componentType: AppComponentType,
	remoteComponentName: string,
): string | undefined {
	return origin.idMapping[componentType].find((mapping) => mapping.remote === remoteComponentName)?.local;
}
