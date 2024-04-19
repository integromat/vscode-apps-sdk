import { AxiosRequestConfig } from 'axios';
import { AppComponentMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from './consts';
import { log } from '../output-channel';
import { AppComponentType } from '../types/app-component-type.types';
import * as Core from '../Core';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { getModuleDefFromType } from '../services/module-types-naming';
import { ConnectionType, WebhookType } from '../types/component-types.types';

const ENVIRONMENT_VERSION = 2;

/**
 * Creates new SDK App component in remote Make.
 * Note: Content will stay filled by templated codes. No local codes are updates by this function.
 *
 * @param opt.componentName New component ID (for components, where it can be defined by user)
 * @returns Remote component name of new remote component
 */
export async function createRemoteAppComponent(opt: {
	appName: string;
	appVersion: number;
	componentType: AppComponentType;
	componentName: string;
	componentMetadata: AppComponentMetadata;
	origin: LocalAppOriginWithSecret;
}): Promise<string> {
	try {
		switch (opt.componentType) {
			case 'connection': {
				const newConnId = await createRemoteConnection(opt);
				return newConnId;
			}
			case 'module':
				await createRemoteModule(opt);
				return opt.componentName;
			case 'webhook': {
				const newWebhookId = await createRemoteWebook(opt);
				return newWebhookId;
			}
			case 'rpc':
				await createRemoteRPC(opt);
				return opt.componentName;
			case 'function':
				await createRemoteIMLFunction(opt);
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

/**
 * Creates a new connection component in remote origin.
 *
 * IMPORTANT: Not suitable for legacy Integromat API.
 * @returns Connection ID (name)
 */
async function createRemoteConnection(opt: {
	origin: LocalAppOriginWithSecret;
	componentMetadata: AppComponentMetadata;
}): Promise<string> {
	log(
		'debug',
		`Create connection "${opt.componentMetadata.label ?? '[unlabeled]'}" in remote app "${opt.origin.appId}"`,
	);
	progresDialogReport(`Creating connection ${opt.componentMetadata.label ?? '[unlabeled]'} in remote`);
	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}/${opt.origin.appId}/${Core.pathDeterminer(ENVIRONMENT_VERSION, 'connection')}`,
		method: 'POST',
		data: { label: opt.componentMetadata.label, type: opt.componentMetadata.connectionType },
	};
	const response = await requestMakeApi<CreateConnectionApiResponse>(axiosConfig);

	progresDialogReport('');
	return response.appConnection.name; // Connection ID (name)
}

interface CreateConnectionApiResponse {
	appConnection: {
		name: string;
		type: ConnectionType;
		label: string;
	};
}

/**
 * Creates a new module component in remote origin.
 *
 * IMPORTANT: Not suitable for legacy Integromat API.
 */
async function createRemoteModule(opt: {
	origin: LocalAppOriginWithSecret;
	componentMetadata: AppComponentMetadata;
	componentName: string;
}): Promise<void> {
	log('debug', `Creating module "${opt.componentName}" in remote app ${opt.origin.appId}`);
	progresDialogReport(`Creating module ${opt.componentMetadata.label ?? opt.componentName} in remote`);

	if (opt.componentMetadata.moduleType === undefined) {
		throw new Error(`Module type must be defined, but missing. Check the ${MAKECOMAPP_FILENAME}.`);
	}

	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}/${opt.origin.appId}/${opt.origin.appVersion}/modules`,
		method: 'POST',
		data: {
			name: opt.componentName,
			label: opt.componentMetadata.label,
			description: opt.componentMetadata.description,
			typeId: getModuleDefFromType(opt.componentMetadata.moduleType).type_id,
			// TODO connection: opt.componentMetadata.connection ?? '', // empty string in API represents the `null`
			// altConnection is not present during module creation in web UI. Check it
			// TODO altConnection: opt.componentMetadata.altConnection ?? '', // empty string in API represents the `null`
			// TODO webhook: opt.componentMetadata.webhook,
			crud: opt.componentMetadata.actionCrud ?? '',
		},
	};
	await requestMakeApi<CreateModuleApiResponse>(axiosConfig);

	progresDialogReport('');
}

/**
 * Creates a new Remote Procedure component in remote origin.
 *
 * IMPORTANT: Not suitable for legacy Integromat API.
 */
async function createRemoteRPC(opt: {
	origin: LocalAppOriginWithSecret;
	componentMetadata: AppComponentMetadata;
	componentName: string;
}): Promise<void> {
	log('debug', `Creating RPC "${opt.componentName}" in remote app ${opt.origin.appId}`);
	progresDialogReport(`Creating RPC ${opt.componentMetadata.label ?? opt.componentName} in remote`);

	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}/${opt.origin.appId}/${opt.origin.appVersion}/${Core.pathDeterminer(
			ENVIRONMENT_VERSION,
			'rpc',
		)}`,
		method: 'POST',
		data: {
			name: opt.componentName,
			label: opt.componentMetadata.label,
			// TODO connection: ...
		},
	};
	await requestMakeApi(axiosConfig);

	progresDialogReport('');
}

/**
 * Creates a new webhook component in remote origin.
 *
 * IMPORTANT: Not suitable for legacy Integromat API.
 * @returns webhook ID (name)
 */
async function createRemoteWebook(opt: {
	origin: LocalAppOriginWithSecret;
	componentMetadata: AppComponentMetadata;
}): Promise<string> {
	log(
		'debug',
		`Create webhook "${opt.componentMetadata.label ?? '[unlabeled]'}" in remote app "${opt.origin.appId}"`,
	);
	progresDialogReport(`Creating webhook ${opt.componentMetadata.label ?? '[unlabeled]'} in remote`);

	if (opt.componentMetadata.webhookType === undefined) {
		throw new Error(`Webhook type must be defined, but missing. Check the ${MAKECOMAPP_FILENAME}.`);
	}

	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}/${opt.origin.appId}/${Core.pathDeterminer(ENVIRONMENT_VERSION, 'webhook')}`,
		method: 'POST',
		data: { type: opt.componentMetadata.webhookType, label: opt.componentMetadata.label },
	};
	const response = await requestMakeApi<CreateWebhookApiResponse>(axiosConfig);

	progresDialogReport('');
	return response.appWebhook.name; // Webhook ID (name)
}

/**
 * Creates a new Remote Procedure component in remote origin.
 *
 * IMPORTANT: Not suitable for legacy Integromat API.
 */
async function createRemoteIMLFunction(opt: {
	origin: LocalAppOriginWithSecret;
	componentMetadata: AppComponentMetadata;
	componentName: string;
}): Promise<void> {
	log('debug', `Creating Custom IML Function "${opt.componentName}" in remote app ${opt.origin.appId}`);
	progresDialogReport(`Creating Custom IML Function ${opt.componentMetadata.label ?? opt.componentName} in remote`);

	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}/${opt.origin.appId}/${opt.origin.appVersion}/${Core.pathDeterminer(
			ENVIRONMENT_VERSION,
			'function',
		)}`,
		method: 'POST',
		data: {
			name: opt.componentName,
		},
	};
	await requestMakeApi(axiosConfig);

	progresDialogReport('');
}

interface CreateWebhookApiResponse {
	appWebhook: {
		/** Webhook ID (name) */
		name: string;
		type: WebhookType;
		label: string;
	};
}

interface CreateModuleApiResponse {
	appModule: {
		name: string;
		label: string;
		description: string;
		typeId: number;
		crud: string | null; // TODO Improve Typescript type to own CRUD type instead of string
		connection: string | null;
		webhook: string | null;
	};
}
