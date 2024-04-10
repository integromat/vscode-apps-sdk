import * as vscode from 'vscode';
import { getMakecomappRootDir } from './makecomappjson';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { catchError } from '../error-handling';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-imlfunction',
		catchError('Create Custom IML Function at local', onCreateLocalImlFunctionClick),
	);
}

/**
 * Handles the VS Code right click and select "Create local component: IML Function".
 *
 * Asks user for couple of details about intended IML function and then creates it, including local files.
 */
async function onCreateLocalImlFunctionClick(anyProjectPath: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(anyProjectPath);

	// Ask for local ID
	const imlFunctionLocalId = await askNewComponentLocalID('IML function', true);
	if (imlFunctionLocalId === undefined) {
		return; /* Cancelled by user */
	}

	const newImlFunction = await createLocalEmptyComponent('function', imlFunctionLocalId, {}, makeappRootDir);

	// OK info message
	vscode.window.showInformationMessage(
		`The Custom IML function "${newImlFunction.componentLocalId}" sucessfully created locally.`,
	);
}
