import * as vscode from 'vscode';
import { catchError } from '../error-handling';
import { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';
import { entries } from '../utils/typed-object';
import { getEmptyCodeContent } from './helpers/get-empty-code-content';
import { askModuleID } from './helpers/ask-component-id';
import { askFreeText } from './helpers/ask-free-text';
import { moduleTypes } from '../services/module-types-naming';
import { ModuleType } from '../types/module-type.types';
import { Crud } from './types/crud.types';

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
	const makeappRootdir = getMakecomappRootDir(file);

	// Ask for module ID
	const moduleID = await askModuleID();
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
		{ ignoreFocusOut: true, title: 'Select the type of module tobe created' },
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

	const moduleMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles = {
		...moduleMetadata,
		codeFiles: await generateComponentDefaultCodeFilesPaths(
			// Generate Local file paths (Relative to app rootdir) + store metadata
			'module',
			moduleID,
			moduleMetadata,
			makeappRootdir,
		),
	};
	// Create new code files
	await createLocalModule(moduleID, moduleMetadataWithCodeFiles, makeappRootdir);

	// OK info message
	vscode.window.showInformationMessage(`Module "${moduleID}" sucessfully created locally.`);
}

/**
 * Creates new Module in local development.
 *
 * Creates all necessary files and adds new module to makecomapp.json
 */
async function createLocalModule(
	moduleName: string,
	moduleMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles,
	makeappRootdir: vscode.Uri,
) {
	for (const [codeType, codeFilePath] of entries(moduleMetadataWithCodeFiles.codeFiles)) {
		const codeFileUri = vscode.Uri.joinPath(makeappRootdir, codeFilePath);
		await vscode.workspace.fs.writeFile(codeFileUri, new TextEncoder().encode(getEmptyCodeContent(codeType)));
	}

	// Write changes to makecomapp.json file
	await upsertComponentInMakecomappjson('module', moduleName, moduleMetadataWithCodeFiles, makeappRootdir);
}
