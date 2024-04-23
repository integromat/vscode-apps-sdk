import type { AxiosRequestConfig } from 'axios';
import type { AppComponentMetadata, LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { getComponentRemoteMetadataToDeploy } from './deploy-metadata';
import { getComponentApiUrl } from './helpers/api-url';
import { log } from '../output-channel';
import type { AppComponentType } from '../types/app-component-type.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { getModuleDefFromType } from '../services/module-types-naming';
import type { ConnectionType, WebhookType } from '../types/component-types.types';

/**
 * Creates new SDK App component in remote Make.
 * Note: Content will stay filled by templated codes. No local codes are updates by this function.
 *
 * @param opt.componentName New component ID (for components, where it can be defined by user)
 * @returns Actual remote component name of new remote component
 */
export async function createRemoteAppComponent(opt: {
	appName: string;
	appVersion: number;
	componentType: AppComponentType;
	componentName: string;
	componentMetadata: AppComponentMetadata;
	makecomappJson: MakecomappJson;
	origin: LocalAppOriginWithSecret;
}): Promise<string> {
	try {
		const infoMessage = `Creating ${opt.componentName} "${
			opt.componentMetadata.label ?? opt.componentName
		}" in remote app ${opt.origin.appId}`;
		log('debug', infoMessage);
		progresDialogReport(infoMessage);

		const componentCreationUrl = getComponentApiUrl({
			componentType: opt.componentType,
			remoteComponentName: undefined,
			origin: opt.origin,
		});
		const componentIdMapping = new ComponentIdMappingHelper(opt.makecomappJson, opt.origin);
		const axiosConfig: AxiosRequestConfig = {
			headers: {
				Authorization: 'Token ' + opt.origin.apikey,
			},
			url: componentCreationUrl,
			method: 'POST',
			// Add all editable component metadata
			data: getComponentRemoteMetadataToDeploy('module', opt.componentMetadata, opt.makecomappJson, opt.origin),
		};

		// Add metadata, which are not covered by `getComponentRemoteMetadataToDeploy`,
		//   because there are persistent/not-editable after component creation.

		switch (opt.componentType) {
			case 'module':
				// For Module: Add `typeId` of module
				if (opt.componentMetadata.moduleType === undefined) {
					throw new Error(
						`"moduleType" type must be defined for module "${
							opt.componentMetadata.label ?? opt.componentName
						}", but missing. Check the ${MAKECOMAPP_FILENAME}.`,
					);
				}
				axiosConfig.data.typeId = getModuleDefFromType(opt.componentMetadata.moduleType).type_id;

				// For Module Action: Add `crud`
				if (opt.componentMetadata.moduleType === 'action') {
					if (!opt.componentMetadata.actionCrud) {
						throw new Error(
							`"actionCrud" type must be defined for module "${
								opt.componentMetadata.label ?? opt.componentName
							}", but missing. Check the ${MAKECOMAPP_FILENAME}.`,
						);
					}
					axiosConfig.data.crud = opt.componentMetadata.actionCrud;
				}

				// For Module Instant trigger: Add webhook reference (mandatory)
				if (opt.componentMetadata.moduleType === 'instant_trigger') {
					if (!opt.componentMetadata.webhook) {
						throw new Error(
							`"webhook" type must be defined for Instant Trigger module "${
								opt.componentMetadata.label ?? opt.componentName
							}", but missing. Check the ${MAKECOMAPP_FILENAME}.`,
						);
					}
					axiosConfig.data.webhook = componentIdMapping.getComponentReferenceRemoteNameForApiPatch(
						'webhook',
						opt.componentMetadata.webhook,
					);
				}
				break;

			case 'connection':
				// For Connection: Add `type`
				if (opt.componentMetadata.connectionType === undefined) {
					throw new Error(
						`"connectionType" type must be defined for connection "${
							opt.componentMetadata.label ?? opt.componentName
						}", but missing. Check the ${MAKECOMAPP_FILENAME}.`,
					);
				}
				axiosConfig.data.type = opt.componentMetadata.connectionType;
				break;

			case 'webhook':
				// Webhook type: add `webhookType`
				if (opt.componentMetadata.webhookType === undefined) {
					throw new Error(
						`"webhookType" type must be defined for connection "${
							opt.componentMetadata.label ?? opt.componentName
						}", but missing. Check the ${MAKECOMAPP_FILENAME}.`,
					);
				}
				axiosConfig.data.type = opt.componentMetadata.webhookType;
				break;
		}

		// For Module, RPC, function: add `name` (ID)
		if (['module', 'rpc', 'function'].includes(opt.componentType)) {
			axiosConfig.data.name = opt.componentName;
		}

		// Send request to Make
		const response = await requestMakeApi(axiosConfig);

		progresDialogReport('');

		// Return the new component's actual remote name
		switch (opt.componentType) {
			case 'connection':
				return (response as CreateConnectionApiResponse).appConnection.name;
			case 'webhook':
				return (response as CreateWebhookApiResponse).appWebhook.name;
			case 'module':
				return opt.componentName;
			case 'rpc':
				return opt.componentName;
			case 'function':
				return opt.componentName;
			default:
				throw new Error(
					`Creation of ${opt.componentType} "${
						opt.componentMetadata.label ?? opt.componentName
					}" not implemented or type is unknown.`,
				);
		}
	} catch (e: any) {
		e.message = `Failed to create ${opt.componentType} "${
			opt.componentMetadata.label ?? opt.componentName
		}" in remote "${opt.origin.label || opt.origin.appId}". ${e.message}`;
		throw e;
	}
}

interface CreateConnectionApiResponse {
	appConnection: {
		name: string;
		type: ConnectionType;
		label: string;
	};
}

interface CreateWebhookApiResponse {
	appWebhook: {
		/** Webhook ID (name) */
		name: string;
		type: WebhookType;
		label: string;
	};
}

// -- Disabled, because not used, but describes the actual API response format.
// -- Keeping here for the future use.
// interface CreateModuleApiResponse {
// 	appModule: {
// 		name: string;
// 		label: string;
// 		description: string;
// 		typeId: number;
// 		crud: string | null; // TODO Improve Typescript type to own CRUD type instead of string
// 		connection: string | null;
// 		webhook: string | null;
// 	};
// }
