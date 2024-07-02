import camelCase from 'lodash/camelCase';
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
	const apiURL = getComponentApiUrl({ componentType, remoteComponentName: undefined, origin });

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
	remoteComponentName: string,
	origin: LocalAppOriginWithSecret,
): Promise<T> {
	progresDialogReport(`Getting ${componentType} ${remoteComponentName} metadata`);

	const url = getComponentApiUrl({
		componentType,
		remoteComponentName,
		origin,
	});
	const responseData = await requestMakeApi({
		url,
		headers: {
			Authorization: 'Token ' + origin.apikey,
		},
	});
	const item: T = responseData[camelCase(`app_${componentType}`)];

	progresDialogReport('');
	return item;
}
