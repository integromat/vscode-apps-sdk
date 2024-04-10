import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { getMakecomappRootDir } from './makecomappjson';
import { askFreeText } from './helpers/ask-free-text';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { askNewComponentLocalID } from './helpers/ask-component-id';
import { catchError } from '../error-handling';
import { WebhookType } from '../types/component-types.types';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.create-local-webhook',
		catchError('Create local webhook', onCreateLocalWebhookClick),
	);
}

/**
 * Handle the VS Code right click and select "Create local webhook".
 */
async function onCreateLocalWebhookClick(file: vscode.Uri) {
	const makeappRootDir = getMakecomappRootDir(file);

	// Ask for local ID
	const connectionLocalID = await askNewComponentLocalID('webhook', false);
	if (connectionLocalID === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for webhook label
	const webhookLabel = await askFreeText({
		subject: 'Label (title) of new webhook to be created',
		note: 'Rules: Use any free text, but must not be empty.',
		placeHolder: 'Example: Update user data',
		required: true,
	});
	if (webhookLabel === undefined) {
		return; /* Cancelled by user */
	}

	// Ask for webhook type
	const webhookTypeOptions: { type: WebhookType; label: string }[] = [
		{ type: 'web', label: 'Dedicated URL address' },
		{ type: 'web-shared', label: 'Shared URL address' },
	];
	const webhookTypePick = await vscode.window.showQuickPick<vscode.QuickPickItem & (typeof webhookTypeOptions)[0]>(
		webhookTypeOptions,
		{ ignoreFocusOut: true, title: 'Select the type of webhook to be created' },
	);
	if (!webhookTypePick) {
		return;
	}

	const webhookMetadata: AppComponentMetadata = {
		label: webhookLabel,
		webhookType: webhookTypePick.type,
	};

	const newWebhook = await createLocalEmptyComponent('webhook', connectionLocalID, webhookMetadata, makeappRootDir);

	// OK info message
	vscode.window.showInformationMessage(`Webhook "${newWebhook.componentLocalId}" sucessfully created locally.`);
}
