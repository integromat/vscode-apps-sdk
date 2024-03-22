import * as vscode from 'vscode';
import { AppComponentMetadata, AppComponentTypesMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { getAppComponentTypes } from '../services/component-code-def';
import { getAppComponentDetails, getAppComponents } from '../services/get-app-components';
import {
	ComponentsApiResponseConnectionItem,
	ComponentsApiResponseItem,
	ComponentsApiResponseModuleItem,
	ComponentsApiResponseWebhookItem,
} from '../types/get-component-api-response.types';
import { getModuleDefFromId } from '../services/module-types-naming';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';

/**
 * Gets list of all components from remote origin (in Make).
 * All component references are as remote component name (not as Local ID).
 */
export async function getAllRemoteComponentsSummaries(
	anyProjectPath: vscode.Uri,
	origin: LocalAppOriginWithSecret,
): Promise<AppComponentTypesMetadata<AppComponentMetadata>> {
	const components: Awaited<ReturnType<typeof getAllRemoteComponentsSummaries>> = {
		connection: {},
		webhook: {},
		module: {},
		rpc: {},
		function: {},
	};

	// Process all app's compoments
	for (const appComponentType of getAppComponentTypes()) {
		const appComponentSummaryList = await getAppComponents<ComponentsApiResponseItem>(appComponentType, origin);

		for (const appComponentSummary of appComponentSummaryList) {
			// Create section in makecomapp.json
			const componentMetadata: AppComponentMetadata = {
				label: appComponentSummary.label,
			};
			switch (appComponentType) {
				case 'connection':
					componentMetadata.connectionType = (
						appComponentSummary as ComponentsApiResponseConnectionItem
					).type;
					break;
				case 'webhook':
					componentMetadata.webhookType = (appComponentSummary as ComponentsApiResponseWebhookItem).type;

					break;
				case 'module':
					componentMetadata.description = appComponentSummary.description;
					componentMetadata.moduleType = getModuleDefFromId(
						(appComponentSummary as ComponentsApiResponseModuleItem).typeId,
					).type;
					if (componentMetadata.moduleType === 'action') {
						componentMetadata.actionCrud = (appComponentSummary as ComponentsApiResponseModuleItem).crud;
					}
					break;
			}

			// Load additional/specific properties
			if (['module', 'webhook', 'rpc'].includes(appComponentType)) {
				const componentDetails = await getAppComponentDetails(
					appComponentType,
					appComponentSummary.name,
					origin,
				);
				// Add `connection` and `altConnection`
				if (componentDetails.connection === undefined) {
					// This should not occure on production. It is here for input validation only.
					throw new Error(
						`Missing expected property 'connection' on remote ${appComponentType} ${appComponentSummary.name}.`,
					);
				}
				if (componentDetails.altConnection === undefined) {
					// This should not occure on production. It is here for input validation only.
					throw new Error(
						`Missing expected property 'altConnection' on remote ${appComponentType} ${appComponentSummary.name}.`,
					);
				}
				componentMetadata.connection = componentDetails.connection;

				componentMetadata.altConnection = componentDetails.altConnection;

				// Add reference from Instant Trigger to Webhook
				if (appComponentType === 'module' && componentMetadata.moduleType === 'instant_trigger') {
					if (componentDetails.webhook === undefined) {
						// This should not occure on production. It is here for input validation only.
						throw new Error(
							`Missing expected property 'webhook' on remote ${componentMetadata.moduleType} ${appComponentType} ${appComponentSummary.name}.`,
						);
					}
					componentMetadata.webhook = componentDetails.webhook;
				}
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}

export function convertComponentMetadataRemoteNamesToLocalIds(
	componentMetadata: AppComponentMetadata,
	componentIdMapping: ComponentIdMappingHelper,
): AppComponentMetadata {
	const updatedComponentMedatada: AppComponentMetadata = {
		...componentMetadata,
	};
	if (updatedComponentMedatada.connection) {
		updatedComponentMedatada.connection =
			componentIdMapping.getLocalIdStrict('connection', updatedComponentMedatada.connection);
		if (updatedComponentMedatada.connection === null) {
			delete updatedComponentMedatada.connection;
			// Explanation: Covers the special case, where `ignore this component` is defined in ID mapping.
			//   For this case, do not store (and manage) this reference.
		}
	}
	if (updatedComponentMedatada.altConnection) {
		updatedComponentMedatada.altConnection =
			componentIdMapping.getLocalIdStrict('connection', updatedComponentMedatada.altConnection);
		if (updatedComponentMedatada.altConnection === null) {
			delete updatedComponentMedatada.altConnection;
			// Explanation: Covers the special case, where `ignore this component` is defined in ID mapping.
			//   For this case, do not store (and manage) this reference.
		}
	}
	if (updatedComponentMedatada.webhook) {
		updatedComponentMedatada.webhook =
			componentIdMapping.getLocalIdStrict('webhook', updatedComponentMedatada.webhook);
		if (updatedComponentMedatada.webhook === null) {
			delete updatedComponentMedatada.webhook;
			// Explanation: Covers the special case, where `ignore this component` is defined in ID mapping.
			//   For this case, do not store (and manage) this reference.
		}
	}
	return updatedComponentMedatada;
}
