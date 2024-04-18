import camelCase from 'lodash/camelCase';
import { apiV2SdkAppsBasePath } from './consts';
import { AppComponentType } from '../types/app-component-type.types';
import { LocalAppOriginWithSecret } from '../local-development/types/makecomapp.types';
import { ComponentDetailsApiResponseItem, ComponentsApiResponseItem } from '../types/get-component-api-response.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { getComponentApiUrl } from '../local-development/helpers/api-url';

/**
 * Gets list of components summaries of the given type for the given app.
 * Note: Not suitabled for Legacy Integromat API.
 */
export async function getAppComponents<T extends ComponentsApiResponseItem>(
	componentType: AppComponentType,
	origin: LocalAppOriginWithSecret,
): Promise<T[]> {
	const apiURL =
		`${origin.baseUrl}/${apiV2SdkAppsBasePath}/${origin.appId}/` +
		(['connection', 'webhook'].includes(componentType) ? '' : `${origin.appVersion}/`) +
		componentType +
		's';

	progresDialogReport(`Getting ${componentType}s list`);

	const responseData = await requestMakeApi({
		url: apiURL,
		headers: {
			Authorization: 'Token ' + origin.apikey,
		},
	});

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
	const componentApiUrl = getComponentApiUrl({
		appComponentType: componentType,
		remoteComponentName: componentName,
		origin,
	});
	progresDialogReport(`Getting ${componentType} ${componentName} metadata`);

	const responseData = await requestMakeApi({
		url: componentApiUrl,
		headers: {
			Authorization: 'Token ' + origin.apikey,
		},
	});
	const item: T = responseData[camelCase(`app_${componentType}`)];

	progresDialogReport('');
	return item;
}
