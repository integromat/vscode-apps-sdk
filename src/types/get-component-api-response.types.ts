import type { ConnectionType, WebhookType } from './component-types.types';
import type { Crud } from '../local-development/types/crud.types';

/**
 * Item of array `appModules` of API response:
 * /api/v2/sdk/apps/[appId]/[appVersion]/modules
 */
export interface ComponentsApiResponseModuleItem {
	approved: boolean;
	crud: Crud | null;
	description: string;
	label: string;
	name: string;
	public: boolean;
	typeId: number;
}

/**
 * Item `appModule` of API response:
 * /api/v2/sdk/apps/[appId]/[appVersion]/accounts/[moduleId]
 */
export interface ConnectionComponentDetailsApiResponseItem extends ComponentsApiResponseConnectionItem {
	// Note: Some other properties can be present. But not used in app, therefore it is not described for 100%.
}

/**
 * Item `appModule` of API response:
 * /api/v2/sdk/apps/[appId]/[appVersion]/modules/[moduleId]
 */
export interface ModuleComponentDetailsApiResponseItem extends ComponentsApiResponseModuleItem {
	/** Remote connection Name */
	connection: string | null;
	/** Remote altConnection Name */
	altConnection: string | null;
	/**
	 * Remote webhook name.
	 * Used for "dedicated webhook" only. Null in other cases.
	 */
	webhook: string | null;
}

/**
 * Item `appWebhook` of API response:
 * /api/v2/sdk/apps/webhooks/[webhhookId]
 */
export interface WebhookComponentDetailsApiResponseItem extends ComponentsApiResponseWebhookItem {
	connection: string | null;
	altConnection: string | null;
}

/**
 * Item `appRpc` of API response:
 * /api/v2/sdk/apps/rpcs/[rpcId]
 */
export interface RpcComponentDetailsApiResponseItem extends ComponentsApiResponseRpcItem {
	connection: string | null;
	altConnection: string | null;
}

/**
 * Item of array `appConnections` of API response:
 * /api/v2/sdk/apps/[appId]/connections
 */
export interface ComponentsApiResponseConnectionItem {
	name: string;
	label: string;
	type: ConnectionType;
	appVersion:	number;
}

/**
 * Item of array `appWebhooks` of API response:
 * /api/v2/sdk/apps/[appId]/webhooks
 */
export interface ComponentsApiResponseWebhookItem {
	name: string;
	label: string;
	type: WebhookType;
}

/**
 * Item of array `appRpcs` of API response:
 * /api/v2/sdk/apps/[appId]/[appVersion]/rpcs
 */
export interface ComponentsApiResponseRpcItem {
	name: string;
	label: string;
}

/**
 * Item of array `appFunctions` of API response:
 * /api/v2/sdk/apps/[appId]/[appVersion]/functions
 */
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

export type ComponentDetailsApiResponseItem = Partial<ModuleComponentDetailsApiResponseItem> &
	Partial<ConnectionComponentDetailsApiResponseItem> &
	Partial<WebhookComponentDetailsApiResponseItem> &
	Partial<RpcComponentDetailsApiResponseItem>;
