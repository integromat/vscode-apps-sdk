import * as path from 'path';
import { existsSync } from 'fs';
import * as vscode from 'vscode';
import throat from 'throat';
import { getCurrentWorkspace } from '../services/workspace';
import { AppComponentMetadataWithCodeFiles, MakecomappJson } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { TextDecoder, TextEncoder } from 'util';
import { log } from '../output-channel';
import { AppComponentType } from '../types/app-component-type.types';

const limitConcurrency = throat(1);

/**
 * Finds the nearest parent dir, where makecomapp.json is located.
 * File must be located in the workspace.
 * @return Directory, where makecomapp.json is located.
 */
export function getMakecomappRootDir(anyProjectPath: vscode.Uri): vscode.Uri {
	const workspace = getCurrentWorkspace();
	const startDirRelative = path.posix.relative(workspace.uri.path, anyProjectPath.path);
	if (startDirRelative.startsWith('..') || anyProjectPath.fsPath === path.parse(anyProjectPath.fsPath).root) {
		throw new Error(`Appropriate ${MAKECOMAPP_FILENAME} file not found in the workspace.`);
	}

	if (existsSync(path.join(anyProjectPath.fsPath, MAKECOMAPP_FILENAME))) {
		return anyProjectPath;
	} else {
		return getMakecomappRootDir(vscode.Uri.joinPath(anyProjectPath, '..'));
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
	return makecomappJson;
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
	componentName: string,
	componentMetadata: AppComponentMetadataWithCodeFiles,
	anyProjectPath: vscode.Uri,
) {
	await limitConcurrency(async () => {
		const makecomappJson = await getMakecomappJson(anyProjectPath);
		makecomappJson.components[componentType][componentName] = componentMetadata;
		await updateMakecomappJson(anyProjectPath, makecomappJson);
	});
}
