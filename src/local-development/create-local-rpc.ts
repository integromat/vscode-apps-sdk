import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappRootDir } from './makecomappjson';
import { askFreeText } from './helpers/ask-free-text';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { askForLinkConnection } from './helpers/ask-connection';
import { catchError } from '../error-handling';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-rpc',
		catchError('Create Remote Procedure at local', onCreateLocalRpcClick),
	);
}

/**
 * Handles the VS Code right click and select "New Local Component: Remote Procedure".
 *
 * Asks user for couple of details about intended RPC and then creates it, including local files.
 */
async function onCreateLocalRpcClick(anyProjectPath: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(anyProjectPath);

	// Ask for local ID
	const rpcLocalID = await askNewComponentLocalID('rpc', false);
	if (rpcLocalID === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for label
	const rpcLabel = await askFreeText({
		subject: 'Label (title) of new Remote Procedure to be created',
		note: 'Rules: Use any free text, but must not be empty.',
		placeHolder: 'Example: Update user data',
		required: true,
	});
	if (rpcLabel === undefined) {
		return; /* Cancelled by user */
	}

	const linkedConnection = await askForLinkConnection(makeappRootDir, 'connection');
	if (linkedConnection === undefined) {
		return; /* Cancelled by user */
	}

	const linkedAltConnection = await askForLinkConnection(makeappRootDir, 'alternative Connection');
	if (linkedAltConnection === undefined) {
		return; /* Cancelled by user */
	}

	const newComponentMetadata: AppComponentMetadata = {
		label: rpcLabel,
		connection: linkedConnection,
		altConnection: linkedAltConnection,
	};

	const newRpc = await createLocalEmptyComponent('rpc', rpcLocalID, newComponentMetadata, makeappRootDir);

	// OK info message
	vscode.window.showInformationMessage(
		`The Remote Procedure "${newRpc.componentLocalId}" sucessfully created locally.`,
	);
}
