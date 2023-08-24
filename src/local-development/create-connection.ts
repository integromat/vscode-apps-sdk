import * as vscode from 'vscode';
import { catchError } from '../error-handling';
import { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getMakecomappJson, getMakecomappRootDir, updateMakecomappJson } from './makecomappjson';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-connection',
		catchError('Create Connection', createConnection),
	);
}

/** Creates new 'connection' component into local project */
async function createConnection(file: vscode.Uri) {
	const makecomappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);

	const appConnectionBasename = makecomappJson.origins[0]?.appId ?? 'unnamedapp';
	let appConnectionNameSuffix: string | number = '';
	while (makecomappJson.components.connection[appConnectionBasename + appConnectionNameSuffix] !== undefined) {
		appConnectionNameSuffix = typeof appConnectionNameSuffix === 'string' ? 1 : appConnectionNameSuffix + 1;
	}

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
			appConnectionBasename + appConnectionNameSuffix,
			connectionMetadata,
			makeappRootdir,
		),
	};
	// Add new connection metadata to makecomapp.json
	makecomappJson.components.connection[appConnectionBasename + appConnectionNameSuffix] =
		connectionMetadataWithCodeFiles;

	// Create new code files
	await createLocalConnection(connectionMetadataWithCodeFiles, makeappRootdir);

	// Write changes to makecomapp.json file
	await updateMakecomappJson(makeappRootdir, makecomappJson);

	// OK info message
	vscode.window.showInformationMessage(`Connection "${appConnectionBasename + appConnectionNameSuffix} created."`);
}

async function createLocalConnection(
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
}
