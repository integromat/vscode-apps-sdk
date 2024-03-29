import * as vscode from 'vscode';
import { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getMakecomappJson, getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';
import { getComponentPseudoId } from './component-pseudo-id';
import { MAKECOMAPP_FILENAME } from './consts';
import { getEmptyCodeContent } from './helpers/get-empty-code-content';
import { askFreeText } from './helpers/ask-free-text';
import { catchError } from '../error-handling';
import { entries } from '../utils/typed-object';
import { ConnectionType } from '../types/component-types.types';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-connection',
		catchError('Create local connection', onCreateLocalConnectionClick),
	);
}

/**
 * Handle the VS Code right click and select "create connection".
 */
async function onCreateLocalConnectionClick(file: vscode.Uri) {
	const makecomappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);

	if (!makecomappJson.origins[0]?.appId) {
		throw new Error(`Cannot create connection, because missing "appId" in "${MAKECOMAPP_FILENAME}" => first "origin".`);
	}

	// Multiple origins warning
	if (makecomappJson.origins.length > 1) {
		const confirmAnswer = await vscode.window.showWarningMessage(
			'Using of multiple remote origins are not fully compatible with connections',
			{
				modal: true,
				detail: 'You have multiple origins defined. This is a complication for connections, ' +
				'which have the autogenerated ID and then cannot be same on all origins. ' +
				`If you will continue, the new connection will be designed for the first origin named "${
					makecomappJson.origins[0].label ?? makecomappJson.origins[0].appId
				}".`,
			},
			{ title: 'Continue' },
		);
		if (confirmAnswer?.title !== 'Continue') {
			return;
		}
	}

	// Find first unused ID (Connection IDs are autoincremental. based on app ID).
	const appId = makecomappJson.origins[0].appId;
	let appConnectionNameSuffix: number | string = '';
	while (makecomappJson.components.connection[appId + appConnectionNameSuffix] !== undefined) {
		appConnectionNameSuffix = typeof appConnectionNameSuffix === 'string' ? 2 : appConnectionNameSuffix + 1;
	}
	const newConnectionTempId = appId + appConnectionNameSuffix;
	const newConnectionPseudoId = getComponentPseudoId('connection', newConnectionTempId, appId);

	// Ask for connection label
	const connectionLabel = await askFreeText({
		subject: 'Label (title) of new connection to be created',
		note: 'Rules: Use any free text, but must not be empty.',
		placeHolder: 'Example: Basic authorization to system',
		required: true,
	});
	if (connectionLabel === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for connection type
	const connectionTypes: { type: ConnectionType, label: string }[] = [
		{ type: 'basic', label: 'Basic Auth, API key auth, Token auth, etc.' },
		{ type: 'oauth', label: 'Oauth 2' },
	];
	const connectionTypePick = await vscode.window.showQuickPick<vscode.QuickPickItem & { id: ConnectionType }>(
		connectionTypes.map((connetionType) => ({ label: connetionType.label, id: connetionType.type })),
		{ ignoreFocusOut: true, title: 'Select the type of connection to be created' },
	);
	if (!connectionTypePick) {
		return;
	}

	const connectionMetadata: AppComponentMetadata = {
		label: connectionLabel,
		connectionType: connectionTypePick.id,
	};

	const connectionMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles = {
		...connectionMetadata,
		codeFiles: await generateComponentDefaultCodeFilesPaths(
			// Generate Local file paths (Relative to app rootdir) + store metadata
			'connection',
			newConnectionPseudoId, // Use 'connection2','connection3',... connections directory name (ignore prefix with app ID).
			connectionMetadata,
			makeappRootdir,
		),
	};
	// Create new code files
	await createLocalConnection(newConnectionTempId, connectionMetadataWithCodeFiles, makeappRootdir);

	// OK info message
	vscode.window.showInformationMessage(`Connection "${newConnectionTempId}" sucessfully created locally.`);
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
	for (const [codeType, codeFilePath] of entries(connectionMetadataWithCodeFiles.codeFiles)) {
		const codeFileUri = vscode.Uri.joinPath(makeappRootdir, codeFilePath);
		await vscode.workspace.fs.writeFile(codeFileUri, new TextEncoder().encode(getEmptyCodeContent(codeType)));
	}

	// Write changes to makecomapp.json file
	await upsertComponentInMakecomappjson('connection', connectionName, connectionMetadataWithCodeFiles, makeappRootdir);
}
