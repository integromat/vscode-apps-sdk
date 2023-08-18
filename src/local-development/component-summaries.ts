import { getAppComponentTypes } from '../services/component-code-def';
import { ComponentSummary, ConnectionComponentSummary, ModuleComponentSummary, WebhookComponentSummary, getAppComponents } from '../services/get-app-components';
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
		const appComponentSummaryList = await getAppComponents<ComponentSummary>(
			appComponentType,
			origin,
		);

		for (const appComponentSummary of appComponentSummaryList) {
			// Create section in makecomapp.json
			const componentMetadata: AppComponentMetadata = {
				label: appComponentSummary.label,
				description: appComponentSummary.description,
			};
			switch (appComponentType) {
				case 'connection':
					componentMetadata['connectionType'] = (appComponentSummary as ConnectionComponentSummary).type;
					break;
				case 'webhook':
					componentMetadata['webhookType'] = (appComponentSummary as WebhookComponentSummary).type;
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = appComponentSummary.connection;
					// componentMetadata['altConnection'] = appComponentSummary.altConnection;
					break;
				case 'module':
					componentMetadata['moduleSubtype'] = getModuleDefFromId(
						(appComponentSummary as ModuleComponentSummary).typeId,
					).type;
					if (componentMetadata['moduleSubtype'] === 'action') {
						componentMetadata['actionCrud'] = (appComponentSummary as ModuleComponentSummary).crud;
					}
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = (appComponentSummary as ModuleComponentSummary).connection;
					// componentMetadata['altConnection'] = (appComponentSummary as ModuleComponentSummary).altConnection;
					break;
				case 'rpc':
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = (appComponentSummary as RpcComponentSummary).connection;
					// componentMetadata['altConnection'] = (appComponentSummary as RpcComponentSummary).altConnection;
					break;
			}

			components[appComponentType][appComponentSummary.name] = componentMetadata;
		}
	}

	return components;
}
