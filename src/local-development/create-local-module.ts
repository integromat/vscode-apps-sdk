import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappRootDir } from './makecomappjson';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { askFreeText } from './helpers/ask-free-text';
import { Crud } from './types/crud.types';
import { optionalAddModuleToDefaultGroup } from './groups-json';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { catchError } from '../error-handling';
import { moduleTypes } from '../services/module-types-naming';
import { ModuleType } from '../types/component-types.types';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-module',
		catchError('Create local module', onCreateLocalModuleClick),
	);
}

const crudTypes: Crud[] = ['create', 'read', 'update', 'delete'];

/**
 * Handle the VS Code right click and select "create module".
 */
async function onCreateLocalModuleClick(file: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(file);

	// Ask for module local ID
	const moduleID = await askNewComponentLocalID('module', true);
	if (moduleID === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for module label
	const moduleLabel = await askFreeText({
		subject: 'Label (title) of new module to be created',
		note: 'Rules: Use any free text, but must not be empty.',
		placeHolder: 'Example: Get list of existing something, ...',
		required: true,
	});
	if (moduleLabel === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for module description
	const moduleDescription = await askFreeText({
		subject: 'Description of new module to be created',
		note: 'Rules: Optional. Use any free text.',
		required: false,
	});
	if (moduleDescription === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for module type
	const moduleTypePick = await vscode.window.showQuickPick<vscode.QuickPickItem & { id: ModuleType }>(
		moduleTypes.map((moduleType) => ({ label: moduleType.label, id: moduleType.type })),
		{ ignoreFocusOut: true, title: 'Select the type of module to be created' },
	);
	if (!moduleTypePick) {
		return;
	}

	// Ask for CRUD
	let actionCrud: Crud | null = null;
	if (moduleTypePick.id === 'action') {
		const actionCrudPick = await vscode.window.showQuickPick<vscode.QuickPickItem & { id: Crud | null }>(
			[...crudTypes.map((crud) => ({ label: crud!, id: crud })), { label: 'none', id: null }],
			{ ignoreFocusOut: true, title: 'Select the type of action module to be created' },
		);
		if (!actionCrudPick) {
			return; /* Cancelled by user */
		}
		actionCrud = actionCrudPick.id;
	}

	const moduleMetadata: AppComponentMetadata = {
		label: moduleLabel,
		description: moduleDescription,
		moduleType: moduleTypePick.id,
		actionCrud: actionCrud,
	};

	const newModule = await createLocalEmptyComponent('module', moduleID, moduleMetadata, makeappRootDir);

	// Update groups.json (if file is filled/used)
	await optionalAddModuleToDefaultGroup(makeappRootDir, newModule.componentLocalId);

	// OK info message
	vscode.window.showInformationMessage(`Module "${moduleID}" sucessfully created locally.`);
}
