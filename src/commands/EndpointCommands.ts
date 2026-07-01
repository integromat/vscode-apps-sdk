import camelCase from 'lodash/camelCase';
import * as vscode from 'vscode';
import * as Core from '../Core';
import * as Validator from '../Validator';
import { catchError } from '../error-handling';
import type { Environment } from '../types/environment.types';
import type { EndpointAnnotations } from '../types/component-types.types';
import { AppsProvider } from '../providers/AppsProvider';
import * as QuickPick from '../QuickPick';

/** The four MCP-inspired endpoint annotation hints, with human-readable descriptions for the picker. */
const ENDPOINT_ANNOTATION_HINTS: { key: keyof EndpointAnnotations; description: string }[] = [
	{ key: 'readOnlyHint', description: 'The endpoint does not modify its environment.' },
	{ key: 'destructiveHint', description: 'The endpoint may perform destructive updates (not only additive).' },
	{ key: 'idempotentHint', description: 'Repeated calls with the same arguments have no additional effect.' },
	{ key: 'openWorldHint', description: 'The endpoint may interact with an "open world" of external entities.' },
];

/**
 * Online-mode commands for the `endpoint` component type.
 * Note: Endpoints exist in API v2 only.
 */
export class EndpointCommands {
	static async register(appsProvider: AppsProvider, _authorization: string, _environment: Environment) {
		/** Base URL of the endpoints collection for the app owning `context` (an endpoint tree Item). */
		const endpointsCollectionUrl = (app: { name: string; version: number }): string =>
			`${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(
				_environment.version,
				'app',
			)}/${app.name}/${app.version}/${Core.pathDeterminer(_environment.version, 'endpoint')}`;

		/**
		 * New endpoint
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.new',
			catchError('Endpoint creation', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return;
				}
				const app = context.parent;

				const label = await vscode.window.showInputBox({ prompt: 'Enter endpoint label' });
				if (!Core.isFilled('label', 'endpoint', label)) {
					return;
				}

				const id = await vscode.window.showInputBox({
					prompt: 'Enter endpoint Id',
					value: camelCase(label),
					validateInput: Validator.endpointName,
				});
				if (!Core.isFilled('id', 'endpoint', id, 'An')) {
					return;
				}

				const description = await vscode.window.showInputBox({
					prompt: 'Enter endpoint description (optional)',
				});
				// `undefined` means the user cancelled the prompt.
				if (description === undefined) {
					return;
				}

				await Core.addEntity(
					_authorization,
					{ name: id, label, ...(description ? { description } : {}) },
					endpointsCollectionUrl(app),
				);
				appsProvider.refresh();
			}),
		);

		/**
		 * Edit endpoint metadata (label, description).
		 * Note: `context` and `annotations` are edited elsewhere (context = source file, annotations = toggle command).
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.edit-metadata',
			catchError('Endpoint metadata edit', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return;
				}

				const label = await vscode.window.showInputBox({
					prompt: 'Customize endpoint label',
					value: context.bareLabel ?? context.label,
				});
				if (!Core.isFilled('label', 'endpoint', label)) {
					return;
				}

				const description = await vscode.window.showInputBox({
					prompt: 'Customize endpoint description (optional)',
					value: context.bareDescription ?? '',
				});
				// `undefined` means the user cancelled the prompt.
				if (description === undefined) {
					return;
				}

				await Core.patchEntity(
					_authorization,
					{ label, description },
					`${endpointsCollectionUrl(context.parent.parent)}/${context.name}`,
				);
				appsProvider.refresh();
			}),
		);

		/**
		 * Mark endpoint as public.
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.visibility.public',
			catchError('Endpoint publish', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return;
				}
				await Core.executePlain(
					_authorization,
					'',
					`${endpointsCollectionUrl(context.parent.parent)}/${context.name}/public`,
				);
				appsProvider.refresh();
			}),
		);

		/**
		 * Mark endpoint as private.
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.visibility.private',
			catchError('Endpoint make private', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return;
				}
				await Core.executePlain(
					_authorization,
					'',
					`${endpointsCollectionUrl(context.parent.parent)}/${context.name}/private`,
				);
				appsProvider.refresh();
			}),
		);

		/**
		 * Toggle endpoint annotations (the 4 MCP-inspired hints) via a multi-select.
		 * The picker is pre-checked from the current state; the full selected set is PATCHed (the web API
		 * writes `annotations` wholesale, so un-picking a hint clears it).
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.edit-annotations',
			catchError('Endpoint annotations edit', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return
				}
				const endpointUrl = `${endpointsCollectionUrl(context.parent.parent)}/${context.name}`;

				// Load current annotations to pre-check the picker.
				const currentAnnotations: EndpointAnnotations =
					(await Core.rpGet(endpointUrl, _authorization))?.appEndpoint?.annotations ?? {};

				const picked = await vscode.window.showQuickPick(
					ENDPOINT_ANNOTATION_HINTS.map((hint) => ({
						label: hint.key,
						description: hint.description,
						picked: currentAnnotations[hint.key] === true,
					})),
					{ canPickMany: true, placeHolder: 'Select the annotation hints that apply to this endpoint' },
				);
				// `undefined` means the user cancelled the picker.
				if (picked === undefined) {
					return;
				}

				const annotations: EndpointAnnotations = {};
				for (const item of picked) {
					annotations[item.label as keyof EndpointAnnotations] = true;
				}

				await Core.patchEntity(_authorization, { annotations }, endpointUrl);
				appsProvider.refresh();
			}),
		);

		/**
		 * Edit endpoint connections (`attachedAccounts`) via a multi-select of the app's connections.
		 * Unlike modules (single primary/alt connection), endpoints reference an array of connections, so the
		 * picker is pre-checked from the current state and the full selected set is PATCHed (wholesale write ⇒
		 * deselecting a connection detaches it).
		 */
		vscode.commands.registerCommand(
			'apps-sdk.endpoint.edit-connections',
			catchError('Endpoint connections edit', async (context: any) => {
				if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) {
					return;
				}
				const app = context.parent.parent;
				const endpointUrl = `${endpointsCollectionUrl(app)}/${context.name}`;

				// Available connections of the app, and the ones currently attached to this endpoint.
				const connections: { label: string; description: string }[] =
					(await QuickPick.connections(_environment, _authorization, app)) ?? [];
				if (connections.length === 0) {
					vscode.window.showInformationMessage('This app has no connections to attach to the endpoint.');
					return;
				}
				const currentAttachedAccounts: string[] =
					(await Core.rpGet(endpointUrl, _authorization))?.appEndpoint?.attachedAccounts ?? [];

				const picked = await vscode.window.showQuickPick(
					connections.map((connection) => ({
						label: connection.label,
						description: connection.description,
						picked: currentAttachedAccounts.includes(connection.description),
					})),
					{ canPickMany: true, placeHolder: 'Select the connections used by this endpoint' },
				);
				// `undefined` means the user cancelled the picker.
				if (picked === undefined) {
					return;
				}

				// `description` holds the connection name (see QuickPick.connections). Filter to a clean
				// `string[]` — `QuickPickItem.description` is optional in the type, so guard against undefined.
				const attachedAccounts = picked
					.map((item) => item.description)
					.filter((name): name is string => Boolean(name));
				await Core.patchEntity(_authorization, { attachedAccounts }, endpointUrl);
				appsProvider.refresh();
			}),
		);
	}
}
