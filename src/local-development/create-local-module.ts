import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappJson, getMakecomappRootDir } from './makecomappjson';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { askFreeText } from './helpers/ask-free-text';
import { Crud } from './types/crud.types';
import { optionalAddModuleToDefaultGroup } from './groups-json';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askForLinkConnection } from './helpers/ask-connection';
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
 * Handles the VS Code right click and select "New Local Component: Module".
 *
 * Asks user for couple of details about intended module and then creates it, including local files.
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
		note: 'Rules: Use any free text, but must not be empty.',
		required: true,
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

	// Universal module: Ask for mandatory subtype
	/*
	 * // Note: Not needed until modules are created empty (without defaulty template).
	 * //       Code is prepared for feature, where local module will be created with code templates.
	 *
	 * // Note: Subtype defines only, which default template will used for universal module creation.
	 *
	 * type UniversalModuleSubtype = 'Universal' | 'UniversalGraphQL';
	 *
	 * let universalModuleSubtype: 'UniversalModuleSubtype' | undefined;
	 * if (moduleTypePick.id === 'universal') {
	 * 	const universalModuleSubtypePick = await vscode.window.showQuickPick(universalModuleSubtypes, {
	 * 		placeHolder: 'Select the subtype of universal module (mandatory)',
	 * 	});
	 * 	if (!universalModuleSubtypePick) {
	 * 		return;
	 * 	}
	 * 	universalModuleSubtype = universalModuleSubtypePick.description as UniversalModuleSubtype; // Note: Actually, the `description` field contains an ID.
	 * }
	 */

	// Ask for CRUD
	let actionCrud: Crud | null = null;
	if (moduleTypePick.id === 'action') {
		const actionCrudPick = await vscode.window.showQuickPick<vscode.QuickPickItem & { id: Crud | null }>(
			[...crudTypes.map((crud) => ({ label: crud!, id: crud })), { label: '- empty -', id: null }],
			{ ignoreFocusOut: true, title: 'Select the type of action module to be created' },
		);
		if (!actionCrudPick) {
			return; /* Cancelled by user */
		}
		actionCrud = actionCrudPick.id;
	}

	// Ask for linked connection
	const linkedConnection = await askForLinkConnection(makeappRootDir, 'connection');
	if (linkedConnection === undefined) {
		return; /* Cancelled by user */
	}

	const linkedAltConnection = await askForLinkConnection(makeappRootDir, 'alternative Connection');
	if (linkedAltConnection === undefined) {
		return; /* Cancelled by user */
	}

	// Instant trigger: Ask for mandatory webhook
	let instantTriggerWebhookLocalId: string | undefined = undefined;
	if (moduleTypePick.id === 'instant_trigger') {
		const makecomappJson = await getMakecomappJson(makeappRootDir);

		const webhooksToQuickPick = Object.entries(makecomappJson.components.webhook)
			.filter(([_webhookLocalId, webhookMetadata]) => webhookMetadata !== null)
			.map(([webhookLocalId, webhookMetadata]) => ({
				label: `Webhook "${webhookMetadata?.label || webhookLocalId}"`,
				id: webhookLocalId,
			}));
		if (webhooksToQuickPick.length === 0) {
			throw new Error(
				'Cannot create the Instant trigger, because it must reference a webhook, but no webhook exists. Please create a webhook first.',
			);
		}
		const webhookPick = await vscode.window.showQuickPick<vscode.QuickPickItem & { id: string }>(
			webhooksToQuickPick,
			{ ignoreFocusOut: true, title: 'Select webhook, which will be referenced to new Instant Trigger' },
		);
		if (!webhookPick) {
			return; /* Cancelled by user */
		}
		instantTriggerWebhookLocalId = webhookPick.id;
	}

	const moduleMetadata: AppComponentMetadata = {
		label: moduleLabel,
		description: moduleDescription,
		moduleType: moduleTypePick.id,
		actionCrud: actionCrud,
		connection: linkedConnection,
		altConnection: linkedAltConnection,
		webhook: instantTriggerWebhookLocalId,
	};

	const newModule = await createLocalEmptyComponent('module', moduleID, moduleMetadata, makeappRootDir);

	// Update groups.json (if file is filled/used)
	await optionalAddModuleToDefaultGroup(makeappRootDir, newModule.componentLocalId);

	// OK info message
	vscode.window.showInformationMessage(`Module "${moduleID}" sucessfully created locally.`);
}
