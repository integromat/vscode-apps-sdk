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

/**
 * Gets list of all components from remote origin (in Make).
 */
export async function getAllRemoteComponentsSummaries(
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
					throw new Error(`Missing expected property 'connection' on remote ${appComponentType} ${appComponentSummary.name}.`);
				}
				if (componentDetails.altConnection === undefined) {
					// This should not occure on production. It is here for input validation only.
					throw new Error(`Missing expected property 'altConnection' on remote ${appComponentType} ${appComponentSummary.name}.`);
				}
				componentMetadata.connection = componentDetails.connection;
				componentMetadata.altConnection = componentDetails.altConnection;
				// Add reference from Instant Trigger to Webhook
				if (appComponentType === 'module' && componentMetadata.moduleType === 'instant_trigger') {
					if (componentDetails.webhook === undefined) {
						// This should not occure on production. It is here for input validation only.
						throw new Error(`Missing expected property 'webhook' on remote ${componentMetadata.moduleType} ${appComponentType} ${appComponentSummary.name}.`);
					}
					componentMetadata.webhook = componentDetails.webhook;
				}
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}
