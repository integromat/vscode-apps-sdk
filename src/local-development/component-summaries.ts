import { AppComponentMetadata, AppComponentTypesMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { getAppComponentTypes } from '../services/component-code-def';
import { getAppComponents } from '../services/get-app-components';
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
export async function getAllComponentsSummaries(
	origin: LocalAppOriginWithSecret,
): Promise<AppComponentTypesMetadata<AppComponentMetadata>> {
	const components: Awaited<ReturnType<typeof getAllComponentsSummaries>> = {
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
					componentMetadata['connectionType'] = (
						appComponentSummary as ComponentsApiResponseConnectionItem
					).type;
					break;
				case 'webhook':
					componentMetadata['webhookType'] = (appComponentSummary as ComponentsApiResponseWebhookItem).type;

					break;
				case 'module':
					componentMetadata['description'] = appComponentSummary.description;
					componentMetadata['moduleType'] = getModuleDefFromId(
						(appComponentSummary as ComponentsApiResponseModuleItem).typeId,
					).type;
					if (componentMetadata['moduleType'] === 'action') {
						componentMetadata['actionCrud'] = (appComponentSummary as ComponentsApiResponseModuleItem).crud;
					}
					break;
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}
