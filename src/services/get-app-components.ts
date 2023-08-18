import * as Core from '../Core';
import camelCase from 'lodash.camelcase';
import { AppComponentType } from '../types/app-component-type.types';
import { Crud } from '../local-development/types/crud.types';
import { ConnectionType, WebhookType } from '../types/module-type.types';
import { LocalAppOriginWithSecret } from '../local-development/types/makecomapp.types';

const ENVIRONMENT_VERSION = 2;

/**
 * Gets list of components summaries of the given type for the given app.
 */
export async function getAppComponents<T extends ComponentSummary>(
	componentType: AppComponentType,
	origin: LocalAppOriginWithSecret,
): Promise<T[]> {
	const apiURL =
		`${origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
			ENVIRONMENT_VERSION,
			'app',
		)}/${origin.appId}/` +
		(['connection', 'webhook'].includes(componentType) ? '' : `${origin.appVersion}`) +
		'/' +
		Core.pathDeterminer(ENVIRONMENT_VERSION, componentType);
	const apiResponse = await Core.rpGet(apiURL, 'Token ' + origin.apikey);
	const items: T[] = apiResponse[camelCase(`app_${componentType}s`)];
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
