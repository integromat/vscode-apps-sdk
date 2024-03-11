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
import { remoteComponentNameToInternalId } from './makecomappjson';

/**
 * Gets list of all components from remote origin (in Make).
 *
 * Note: If `returnedIdType==='local'`, then the function has side-effect:
 *       It registers/writes all new components ID mappings into makecomapp.json file.
 */
export async function getAllRemoteComponentsSummaries(
	anyProjectPath: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	returnedIdType: 'local' | 'remote',
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
				if (returnedIdType === 'local' && componentMetadata.connection) {
					// Translate remote name to local ID.
					componentMetadata.connection = await remoteComponentNameToInternalId(
						'connection',
						componentMetadata.connection,
						anyProjectPath,
						origin,
					);
				}

				componentMetadata.altConnection = componentDetails.altConnection;
				if (returnedIdType === 'local' && componentMetadata.altConnection) {
					// Translate remote name to local ID.
					componentMetadata.altConnection = await remoteComponentNameToInternalId(
						'connection',
						componentMetadata.altConnection,
						anyProjectPath,
						origin,
					);
				}

				// Add reference from Instant Trigger to Webhook
				if (appComponentType === 'module' && componentMetadata.moduleType === 'instant_trigger') {
					if (componentDetails.webhook === undefined) {
						// This should not occure on production. It is here for input validation only.
						throw new Error(
							`Missing expected property 'webhook' on remote ${componentMetadata.moduleType} ${appComponentType} ${appComponentSummary.name}.`,
						);
					}
					componentMetadata.webhook = componentDetails.webhook;
					if (returnedIdType === 'local' && componentMetadata.webhook) {
						// Translate remote name to local ID.
						componentMetadata.webhook = await remoteComponentNameToInternalId(
							'webhook',
							componentMetadata.webhook,
							anyProjectPath,
							origin,
						);
					}
				}
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}
