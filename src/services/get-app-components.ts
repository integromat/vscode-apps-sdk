import camelCase from 'lodash.camelcase';
import { AppComponentType } from '../types/app-component-type.types';
import { LocalAppOriginWithSecret } from '../local-development/types/makecomapp.types';
import axios from 'axios';
import { apiV2SdkAppsBasePath } from './consts';
import { ComponentDetailsApiResponseItem, ComponentsApiResponseItem } from '../types/get-component-api-response.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';

/**
 * Gets list of components summaries of the given type for the given app.
 * Note: Not suitabled for Legacy Integromat API.
 */
export async function getAppComponents<T extends ComponentsApiResponseItem>(
	componentType: AppComponentType,
	origin: LocalAppOriginWithSecret,
): Promise<T[]> {
	const apiURL = getAppComponentsBaseUrl(origin, componentType);

	progresDialogReport(`Getting ${componentType}s list`);

	const responseData = (await axios({
		url: apiURL,
		headers: {
			Authorization: 'Token ' + origin.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
	})).data;

	const items: T[] = responseData[camelCase(`app_${componentType}s`)];

	progresDialogReport('');
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

	progresDialogReport(`Getting ${componentType} ${componentName} metadata`);

	const responseData = (await axios({
		url,
		headers: {
			Authorization: 'Token ' + origin.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
	})).data;
	const item: T = responseData[camelCase(`app_${componentType}`)];

	progresDialogReport('');
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

