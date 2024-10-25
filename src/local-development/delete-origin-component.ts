import { AppComponentType } from '../types/app-component-type.types';
import { log } from '../output-channel';
import { requestMakeApi } from '../utils/request-api-make';
import { AxiosRequestConfig } from 'axios';
import { version as ExtensionVersion } from '../Meta';
import { LocalAppOriginWithSecret } from './types/makecomapp.types';
import { getComponentApiUrl } from './helpers/api-url';

export async function deleteOriginComponent(origin: LocalAppOriginWithSecret, componentType: AppComponentType, remoteComponentName: string) {
	log('info', `Deleting origin ${componentType} '${remoteComponentName}'`);

	const axiosConfig: AxiosRequestConfig = {
		url: getComponentApiUrl({ componentType: componentType, remoteComponentName, origin }),
		method: 'DELETE',
		headers: {
			Authorization: 'Token ' + origin.apikey,
			'imt-vsce-localmode': 'true',
			'imt-apps-sdk-version': ExtensionVersion,
		},
	};
	log('info', `Deleted origin ${componentType} '${remoteComponentName}'`);

	await requestMakeApi(axiosConfig);
}
