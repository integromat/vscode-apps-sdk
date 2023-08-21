import * as vscode from 'vscode';
import { getCurrentWorkspace } from '../services/workspace';
import * as path from 'path';
import { MakecomappJson } from './types/makecomapp.types';
import { existsSync } from 'fs';
import { MAKECOMAPP_FILENAME } from './consts';
import { TextDecoder, TextEncoder } from 'util';
import { log } from '../output-channel';

/**
 * FinSd the nearest parent dir, where makecomapp.json is located.
 * File must be located in the workspace.
 * @return Directory, where makecomapp.json is located.
 */
export function getMakecomappRootDir(startingPath: vscode.Uri): vscode.Uri {
	const workspace = getCurrentWorkspace();
	const startDirRelative = path.relative(workspace.uri.fsPath, startingPath.fsPath);
	if (startDirRelative.startsWith('..') || startingPath.fsPath === path.parse(startingPath.fsPath).root) {
		throw new Error(`Appropriate ${MAKECOMAPP_FILENAME} file not found in the workspace.`);
	}

	if (existsSync(path.join(startingPath.fsPath, MAKECOMAPP_FILENAME))) {
		return startingPath;
	} else {
		return getMakecomappRootDir(vscode.Uri.joinPath(startingPath, '..'));
	}
}

/**
 * Gets makecomapp.json content from the nearest parent dir, where makecomapp.json is located.
 */
export async function getMakecomappJson(startingPath: vscode.Uri): Promise<MakecomappJson> {
	const makecomappRootdir = getMakecomappRootDir(startingPath);
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	const makecomappJson = JSON.parse(
		new TextDecoder().decode(await vscode.workspace.fs.readFile(makecomappJsonPath)),
	) as MakecomappJson;
	return makecomappJson;
}

/**
 * Writes new content into `makecomapp.json` file.
 */
export async function updateMakecomappJson(
	makecomappRootdir: vscode.Uri,
	newMakecomappJson: MakecomappJson,
): Promise<void> {
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	await vscode.workspace.fs.writeFile(
		makecomappJsonPath,
		new TextEncoder().encode(JSON.stringify(newMakecomappJson, null, 4)),
	);
}

/**
 * Renames connection ID in makecomapp.json. Renames also all references of the connection.
 * Note: It does NOT rename connection in Make, it edits the 'makecomapp.json' content only.
 *
 * SIDEEFFECT: edits original object in param `makeappJson`.
 */
export function renameConnection(makecomappJson: MakecomappJson, oldId: string, newId: string): void {
	log('debug', `makecomapp.json: Rename connetion ${oldId} => ${newId}`);

	// Rename the connection itself
	const connections = makecomappJson.components.connection;
	const newConnections = Object.fromEntries(
		Object.entries(connections).map(([connectionName, connectionMetadata]) => {
			return [connectionName === oldId ? newId : connectionName, connectionMetadata];
		}),
	);
	makecomappJson.components.connection = newConnections;

	// Rename referecne: connections mentioned in modules
	//
	// TODO Enable after implementation of "moduleConnection" and "moduleAltConnection".
	//
	// Object.values(makeappJson.components.module).forEach((moduleMetadata) => {
	// 	if (moduleMetadata.moduleConnection === oldId) {
	// 		moduleMetadata.moduleConnection === newId;
	// 	}
	// 	if (moduleMetadata.moduleAltConnection === oldId) {
	// 		moduleMetadata.moduleAltConnection === newId;
	// 	}
	// });
}
