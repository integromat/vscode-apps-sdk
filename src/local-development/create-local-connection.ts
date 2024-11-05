import * as vscode from 'vscode';
import type { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappRootDir } from './makecomappjson';
import { askFreeText } from './helpers/ask-free-text';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { catchError } from '../error-handling';
import type { ConnectionType } from '../types/component-types.types';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-connection',
		catchError('Create local connection', onCreateLocalConnectionClick),
	);
}

/**
 * Handle the VS Code right click and select "Create local component: Connection".
 *
 * Asks user for couple of details about intended connection and then creates it, including local files.
 */
async function onCreateLocalConnectionClick(file: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(file);

	// Ask for local ID
	const connectionLocalID = await askNewComponentLocalID('connection', false);
	if (connectionLocalID === undefined) {
		return; /* Cancelled by user */
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
	const connectionTypePick = await vscode.window.showQuickPick<vscode.QuickPickItem & (typeof connectionTypes)[0]>(
		connectionTypes,
		{ ignoreFocusOut: true, title: 'Select the type of connection to be created' },
	);
	if (!connectionTypePick) {
		return;
	}

	const connectionMetadata: AppComponentMetadata = {
		label: connectionLabel,
		connectionType: connectionTypePick.type,
	};

	const newConnection = await createLocalEmptyComponent(
		'connection',
		connectionLocalID,
		connectionMetadata,
		makeappRootDir,
	);

	// OK info message
	vscode.window.showInformationMessage(`Connection "${newConnection.componentLocalId}" sucessfully created locally.`);
}
