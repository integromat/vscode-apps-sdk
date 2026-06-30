import * as vscode from 'vscode';
import type { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappRootDir } from './makecomappjson';
import { askFreeText } from './helpers/ask-free-text';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { catchError } from '../error-handling';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-endpoint',
		catchError('Create Endpoint at local', onCreateLocalEndpointClick),
	);
}

/**
 * Handles the VS Code right click and select "New Local Component: Endpoint".
 *
 * Asks user for couple of details about intended endpoint and then creates it, including local files.
 *
 * Note: Connection references (`attachedAccounts`) and behavior hints (`annotations`) are intentionally
 *       not asked here. In local development they are edited as JSON directly in `makecomapp.json`
 *       (their references are validated on save by `upsertComponentInMakecomappjson()`).
 */
async function onCreateLocalEndpointClick(anyProjectPath: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(anyProjectPath);

	// Ask for local ID
	const endpointLocalID = await askNewComponentLocalID('endpoint', false);
	if (endpointLocalID === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for label
	const endpointLabel = await askFreeText({
		subject: 'Label (title) of new Endpoint to be created',
		note: 'Rules: Use any free text, but must not be empty.',
		placeHolder: 'Example: Get entity',
		required: true,
	});
	if (endpointLabel === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for description (optional)
	const endpointDescription = await askFreeText({
		subject: 'Description of new Endpoint to be created',
		note: 'Rules: Use any free text. Can be left empty.',
		placeHolder: 'Example: Retrieves a single entity by its ID.',
		required: false,
	});
	if (endpointDescription === undefined) {
		return; /* Cancelled by user */
	}

	const newComponentMetadata: AppComponentMetadata = {
		label: endpointLabel,
		...(endpointDescription ? { description: endpointDescription } : {}),
	};

	const newEndpoint = await createLocalEmptyComponent(
		'endpoint',
		endpointLocalID,
		newComponentMetadata,
		makeappRootDir,
	);

	// OK info message
	vscode.window.showInformationMessage(`The Endpoint "${newEndpoint.componentLocalId}" sucessfully created locally.`);
}
