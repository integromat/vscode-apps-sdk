import { AxiosRequestConfig } from 'axios';
import { log } from '../output-channel';
import { AppComponentType } from '../types/app-component-type.types';
import { AppComponentMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';
import * as Core from '../Core';
import { CreateAppComponentPostAction } from './types/create-component-post-action.types';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { requestMakeApi } from '../utils/request-api-make';
import { getModuleDefFromType } from '../services/module-types-naming';
import { MAKECOMAPP_FILENAME } from './consts';

const ENVIRONMENT_VERSION = 2;

/**
 * Creates new SDK App component in remote Make.
 * Note: Content will stay filled by templated codes. No local codes are updates by this function.
 *
 * @param opt.componentName New component ID (for components, where it can be defined by user)
 */
export async function createRemoteAppComponent(opt: {
	appName: string;
	appVersion: number;
	componentType: AppComponentType;
	componentName: string;
	componentMetadata: AppComponentMetadata;
	origin: LocalAppOriginWithSecret;
}): Promise<CreateAppComponentPostAction[]> {
	switch (opt.componentType) {
		case 'connection': {
			const newConnId = await createRemoteConnection(opt);
			return [{ renameConnection: { oldId: opt.componentName, newId: newConnId } }];
		}
		case 'module':
			await createRemoteModule(opt);
			return [];
		default:
			throw new Error(`Creation of ${opt.componentType} ${opt.componentName} not implemented yet. Sorry.`);
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
	)}/`;
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
		type: 'basic' | 'oauth';
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
	)}/`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
		},
		url: `${baseUrl}${opt.origin.appId}/${opt.origin.appVersion}/${Core.pathDeterminer(
			ENVIRONMENT_VERSION,
			'module',
		)}`,
		method: 'POST',
		data: {
			name: opt.componentName,
			label: opt.componentMetadata.label,
			description: opt.componentMetadata.description,
			typeId: getModuleDefFromType(opt.componentMetadata.moduleType).type_id,
			connection: opt.componentMetadata.connection ?? '', // empty string in API represents the `null`
			// TODO altConnection is not present during module creation in web UI. Check it
			altConnection: opt.componentMetadata.altConnection,
			webhook: opt.componentMetadata.webhook,
			crud: opt.componentMetadata.actionCrud ?? '',
		},
	};
	await requestMakeApi<CreateModuleApiResponse>(axiosConfig);

	progresDialogReport('');
}

interface CreateModuleApiResponse {
	appModule: {
		name: string;
		label: string;
		description: string;
		typeId: number;
		crud: string | null; // todo CRUD type
		connection: string | null;
		webhook: string | null;
	};
}
