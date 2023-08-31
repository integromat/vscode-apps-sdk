import * as vscode from 'vscode';
import { catchError } from '../error-handling';
import { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getMakecomappJson, getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-connection',
		catchError('Create Connection', createConnection),
	);
}

/**
 * Creates new 'connection' component into local project
 */
async function createConnection(file: vscode.Uri) {
	const makecomappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);

	if (!makecomappJson.origins[0]?.appId) {
		throw new Error('Cannot create connection, because missing "appId" in "makecomapp.json" => first "origin".');
	}

	// Find first not used ID (Connections use autoincrement ID based on app ID).
	const appId = makecomappJson.origins[0].appId;
	let appConnectionNameSuffix: number | undefined = undefined;
	while (makecomappJson.components.connection[appId + appConnectionNameSuffix] !== undefined) {
		appConnectionNameSuffix = appConnectionNameSuffix === undefined ? 2 : appConnectionNameSuffix + 1;
	}
	const newConnectionTempId = appId + appConnectionNameSuffix;

	const connectionMetadata: AppComponentMetadata = {
		label: 'new connection', // TODO ask user
		description: 'created by local development in VS Code extension', // TODO ask user
		connectionType: 'basic',
	};

	const connectionMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles = {
		...connectionMetadata,
		codeFiles: await generateComponentDefaultCodeFilesPaths(
			// Generate Local file paths (Relative to app rootdir) + store metadata
			'connection',
			String(appConnectionNameSuffix) || '1',  // Use numbers 1,2,3,4,5 connections directory name (ignore prefix with app ID).
			connectionMetadata,
			makeappRootdir,
		),
	};
	// Create new code files
	await createLocalConnection(newConnectionTempId, connectionMetadataWithCodeFiles, makeappRootdir);

	// OK info message
	vscode.window.showInformationMessage(`Connection "${newConnectionTempId} created locally."`);
}

/**
 * Creates new Connection in local development.
 *
 * Creates all necessary files and adds new connection to makecomapp.json
 */
async function createLocalConnection(
	connectionName: string,
	connectionMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles,
	makeappRootdir: vscode.Uri,
) {
	if (connectionMetadataWithCodeFiles.connectionType !== 'basic') {
		throw new Error(
			`Not implemented to create local connection type "${connectionMetadataWithCodeFiles.connectionType}"`,
		);
	}
	for (const [codeName, codeFilePath] of Object.entries(connectionMetadataWithCodeFiles.codeFiles)) {
		const codeFileUri = vscode.Uri.joinPath(makeappRootdir, codeFilePath);
		switch (codeName) {
			case 'api':
			case 'common':
				await vscode.workspace.fs.writeFile(codeFileUri, new TextEncoder().encode('{ }\n'));
				break;
			case 'parameters':
				await vscode.workspace.fs.writeFile(codeFileUri, new TextEncoder().encode('[]\n'));
				break;
			default:
				throw new Error(`Not implemented to create connection code file for "${codeName}"`);
		}
	}

	// Write changes to makecomapp.json file
	await upsertComponentInMakecomappjson('connection', connectionName, connectionMetadataWithCodeFiles, makeappRootdir);
}
