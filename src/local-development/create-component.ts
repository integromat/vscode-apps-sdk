import axios, { AxiosRequestConfig } from 'axios';
import { log } from '../output-channel';
import { AppComponentType } from '../types/app-component-type.types';
import { AppComponentMetadata, LocalAppOriginWithSecret } from './types/makecomapp.types';
import * as Core from '../Core';
import { CreateAppComponentPostAction } from './types/create-component-post-action.types';

const ENVIRONMENT_VERSION = 2;

/**
 * Creates new SDK App component in Make cloud.
 * Note: Content will stay filled by templated codes. No local codes are updates by this function.
 */
export async function createAppComponent(opt: {
	appName: string,
	appVersion: number,
	componentType: AppComponentType,
	componentName: string,
	componentMetadata: AppComponentMetadata,
	origin: LocalAppOriginWithSecret,
}): Promise<CreateAppComponentPostAction[]> {
	switch (opt.componentType) {
		case 'connection': {
			const newConnId = await createConnection(opt);
			return [{ renameConnection: { oldId: opt.componentName, newId: newConnId }}];
		}
//		case 'module':
//			return await createModule(opt)
		default:
			throw new Error(`Creation of ${opt.componentType} ${opt.componentName} not implemented yet. Sorry.`);
	}
}

/**
 * IMPORTANT: Not suitable for legacy Integromat API.
 * @returns Connection ID (name)
 */
async function createConnection(opt: {
	origin: LocalAppOriginWithSecret,
	componentMetadata: AppComponentMetadata,
}): Promise<string> {
	log('debug', `Create connection "${opt.componentMetadata.label ?? '[unlabeled]'}" for app "${opt.origin.appId}"`);
	const baseUrl = `${opt.origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(ENVIRONMENT_VERSION, 'app')}/`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.origin.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
		url: `${baseUrl}/${opt.origin.appId}/${Core.pathDeterminer(ENVIRONMENT_VERSION, 'connection')}`,
		method: 'POST',
		data: { label: opt.componentMetadata.label, type: opt.componentMetadata.connectionType }
	}

	const response = await axios<CreateConnectionApiResponse>(axiosConfig);

	// TODO Change connection ID in makecomapp.json


	return response.data.appConnection.name; // Connection ID (name)
}

interface CreateConnectionApiResponse {
	appConnection: {
		name: string,
		type: 'basic' | 'oauth',
		label: string,
	}
}

/*
async function createModule(opt: {
	appName: string,
	appVersion: number,
	environment: AppsSdkConfigurationEnvironment,
	moduleId: string,
	componentMetadata: AppComponentMetadata,
}): Promise<string> {
	log('debug', `Creating module for ${opt.appName}`);
	const baseUrl = `https://${opt.environment.url}/${Core.pathDeterminer(opt.environment.version, '__sdk')}${Core.pathDeterminer(opt.environment.version, 'app')}/`;
	const axiosConfig: AxiosRequestConfig = {
		headers: {
			Authorization: 'Token ' + opt.environment.apikey,
			// TODO 'x-imt-apps-sdk-version': Meta.version
		},
		url: `${baseUrl}${opt.appName}/${opt.appVersion}/${Core.pathDeterminer(opt.environment.version, 'module')}`,
		method: 'POST',
		data: { label: opt.componentMetadata.label,
			connection: opt.componentMetadata.moduleConnection,
			description: opt.componentMetadata.description,
			name: moduleId,
			webhook: opt.componentMetadata.moduleWebhook,
			subtype: opt.componentMetadata.moduleSubtype,
			// TODO Missing CRUD from opt.componentMetadata.actionCrud
		},
	}
	// Note: API returns { connection, webhook } object.

	const response = await axios(axiosConfig);

	return response.data.name; // Connection ID (name)
}
*/
