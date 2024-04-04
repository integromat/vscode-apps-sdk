import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappJson, getMakecomappRootDir } from './makecomappjson';
import { MAKECOMAPP_FILENAME } from './consts';
import { askFreeText } from './helpers/ask-free-text';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { catchError } from '../error-handling';
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
	const makeappRootDir = getMakecomappRootDir(file);

	if (!makecomappJson.origins[0]?.appId) {
		throw new Error(
			`Cannot create connection, because missing "appId" in "${MAKECOMAPP_FILENAME}" => first "origin".`,
		);
	}

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
	const connectionTypes: { type: ConnectionType; label: string }[] = [
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

	const newConnection = await createLocalEmptyComponent('connection', '', connectionMetadata, makeappRootDir);

	// OK info message
	vscode.window.showInformationMessage(`Connection "${newConnection.componentLocalId}" sucessfully created locally.`);
}
