import camelCase from 'lodash.camelcase';
import { AppComponentType } from '../types/app-component-type.types';
import { Crud } from '../local-development/types/crud.types';
import { ConnectionType, WebhookType } from '../types/module-type.types';
import { LocalAppOriginWithSecret } from '../local-development/types/makecomapp.types';
import axios from 'axios';
import { apiV2SdkAppsBasePath } from './consts';

/**
 * Gets list of components summaries of the given type for the given app.
 * Note: Not suitabled for Legacy Integromat API.
 */
export async function getAppComponents<T extends ComponentsApiResponseItem>(
	componentType: AppComponentType,
	origin: LocalAppOriginWithSecret,
): Promise<T[]> {
	const apiURL = getAppComponentsBaseUrl(origin, componentType);

	const responseData = (await axios({
		url: apiURL,
		headers: {
			Authorization: 'Token ' + origin.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
	})).data;

	const items: T[] = responseData[camelCase(`app_${componentType}s`)];
	return items;
}

/**
 * Gets apps component details.
 *
 * Note: In case of connections and webhooks the origin's app ID and app version is ignored,
 *       because connections and webhooks are "standalone", not under the specific app.
 *
 * Note: Not suitabled for Legacy Integromat API.
 */
export async function getAppComponentDetails<T extends ComponentDetailsApiResponseItem>(
	componentType: AppComponentType,
	componentName: string,
	origin: LocalAppOriginWithSecret,
): Promise<T> {
	let url: string;
	switch (componentType) {
		case 'function':
		case 'rpc':
		case 'module':
			url = getAppComponentsBaseUrl(origin, componentType) + '/' + componentName;
			break;
		case 'connection':
		case 'webhook':
			url = `${origin.baseUrl}/${apiV2SdkAppsBasePath}/${componentType}s/` + componentName;
			break;
		default:
			throw new Error(`Unknown component type "${componentType}"`);
	}

	const responseData = (await axios({
		url,
		headers: {
			Authorization: 'Token ' + origin.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
	})).data;

	const item: T = responseData[camelCase(`app_${componentType}`)];
	return item;
}

function getAppComponentsBaseUrl(
	origin: LocalAppOriginWithSecret,
	componentType: AppComponentType
) {
	return `${origin.baseUrl}/${apiV2SdkAppsBasePath}/${origin.appId}/` +
	(['connection', 'webhook'].includes(componentType) ? '' : `${origin.appVersion}/`) +
	componentType + 's'
}

// interface AppsListItem {
// 	name: string;
// 	label: string;
// 	description: string;
// 	version: any;
// 	beta: any;
// 	theme: any;
// 	public: boolean;
// 	approved: boolean;
// 	changes: any;
// }

export interface ComponentsApiResponseModuleItem {
	approved: boolean;
	crud: Crud | null;
	description: string;
	label: string;
	name: string;
	public: boolean;
	typeId: number;
}

export interface ModuleComponentDetailsApiResponseItem extends ComponentsApiResponseModuleItem {
	connection: string | null;
	altConnection: string | null;
	/* Used for "dedicated webhook" only. Null in other cases. */
	webhook: string | null;
}

export interface ComponentsApiResponseConnectionItem {
	name: string;
	label: string;
	type: ConnectionType;
}

export interface ComponentsApiResponseWebhookItem {
	name: string;
	label: string;
	type: WebhookType;
	// connection: string | null;
	// altConnection: string | null;
}

export interface ComponentsApiResponseRpcItem {
	name: string;
	label: string;
	// connection: string | null;
	// altConnection: string | null;
}

export interface ComponentsApiResponseFunctionItem {
	name: string;
	args: string;
}

export type ComponentsApiResponseItem = Partial<ComponentsApiResponseModuleItem> &
	Partial<ComponentsApiResponseConnectionItem> &
	Partial<ComponentsApiResponseWebhookItem> &
	Partial<ComponentsApiResponseRpcItem> &
	Partial<ComponentsApiResponseFunctionItem> & {
		name: string;
	};


export type ComponentDetailsApiResponseItem = Partial<ModuleComponentDetailsApiResponseItem>;
