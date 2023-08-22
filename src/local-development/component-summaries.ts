import { getAppComponentTypes } from '../services/component-code-def';
import { getAppComponents } from '../services/get-app-components';
import {
	ComponentsApiResponseItem,
	ComponentsApiResponseConnectionItem,
	ComponentsApiResponseModuleItem,
	ComponentsApiResponseWebhookItem,
} from '../types/get-component-api-response.types';
import { getModuleDefFromId } from '../services/module-types-naming';
import { AppComponentMetadata, AppComponentTypesMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';

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
				description: appComponentSummary.description,
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
					componentMetadata['moduleSubtype'] = getModuleDefFromId(
						(appComponentSummary as ComponentsApiResponseModuleItem).typeId,
					).type;
					if (componentMetadata['moduleSubtype'] === 'action') {
						componentMetadata['actionCrud'] = (appComponentSummary as ComponentsApiResponseModuleItem).crud;
					}
					break;
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}
