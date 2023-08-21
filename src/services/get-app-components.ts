import camelCase from 'lodash.camelcase';
import { AppComponentType } from '../types/app-component-type.types';
import { Crud } from '../local-development/types/crud.types';
import { ConnectionType, WebhookType } from '../types/module-type.types';
import { LocalAppOriginWithSecret } from '../local-development/types/makecomapp.types';
import axios from 'axios';
import { apiV2SdkAppsBasePath } from './consts';

/**
 * Gets list of components summaries of the given type for the given app.
 */
export async function getAppComponents<T extends ComponentSummary>(
	componentType: AppComponentType,
	origin: LocalAppOriginWithSecret,
): Promise<T[]> {
	const apiURL =
		`${origin.baseUrl}/${apiV2SdkAppsBasePath}/${origin.appId}/` +
		(['connection', 'webhook'].includes(componentType) ? '' : `${origin.appVersion}`) +
		'/' + componentType + 's';

		const responseData = (await axios({
			url: apiURL,
			headers: {
				Authorization: 'Token ' + origin.apikey,
// TODO				'x-imt-apps-sdk-version': Meta.version
			},
		})).data;

	const items: T[] = responseData[camelCase(`app_${componentType}s`)];
	return items;
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

export interface ModuleComponentSummary {
	approved: boolean;
	crud: Crud | null;
	description: string;
	label: string;
	name: string;
	public: boolean;
	typeId: number;
	connection: string | null;
	altConnection: string | null;
	/* Used for "dedicated webhook" only. Null in other cases. */
	webhook: string | null;
}

export interface ConnectionComponentSummary {
	name: string;
	label: string;
	type: ConnectionType;
}

export interface WebhookComponentSummary {
	name: string;
	label: string;
	type: WebhookType;
	connection: string | null;
	altConnection: string | null;
}

export interface RpcComponentSummary {
	name: string;
	label: string;
	connection: string | null;
	altConnection: string | null;
}

export interface FunctionComponentSummary {
	name: string;
	args: string;
}

export type ComponentSummary = Partial<ModuleComponentSummary> &
	Partial<ConnectionComponentSummary> &
	Partial<WebhookComponentSummary> &
	Partial<RpcComponentSummary> &
	Partial<FunctionComponentSummary> & {
		name: string;
	};
