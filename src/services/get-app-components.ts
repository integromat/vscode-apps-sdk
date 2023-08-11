import * as Core from '../Core';
import { AppsSdkConfigurationEnvironment } from '../providers/configuration';
import camelCase from 'lodash.camelcase';
import { AppComponentType } from '../types/app-component-type.types';
import { Crud } from '../local-development/types/crud.types';

/**
 * Gets list of components summaries of the given type for the given app.
 */
export async function getAppComponents<T extends ComponentSummary>(
	componentType: AppComponentType,
	appName: string,
	appVersion: number,
	environment: AppsSdkConfigurationEnvironment,
): Promise<T[]> {
	const apiURL =
		`https://${environment.url}/v2/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(
			environment.version,
			'app',
		)}/${appName}/` +
		(['connection', 'webhook'].includes(componentType) ? '' : `${appVersion}`) +
		'/' +
		Core.pathDeterminer(environment.version, componentType);
	const apiResponse = await Core.rpGet(apiURL, 'Token ' + environment.apikey);
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

interface ConnectionComponentSummary {
	name: string;
	label: string;
	type: 'oauth' | 'basic';
}

interface WebhookComponentSummary {
	name: string;
	label: string;
	type: 'web' | 'web-shared';
	connection: string | null;
	altConnection: string | null;
}

interface RpcComponentSummary {
	name: string;
	label: string;
	connection: string | null;
	altConnection: string | null;
}

interface FunctionComponentSummary {
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
