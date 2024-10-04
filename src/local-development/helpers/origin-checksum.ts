import { Checksum, ComponentChecksum } from '../types/checksum.types';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeType } from '../types/code-type.types';
import { getCodeDef } from '../code-pull-deploy';
import type { AxiosRequestConfig } from 'axios';
import { requestMakeApi } from '../../utils/request-api-make';
import { log } from '../../output-channel';
import { LocalAppOriginWithSecret } from '../types/makecomapp.types';
import md5 from 'md5';

export async function downloadOriginChecksums(origin: LocalAppOriginWithSecret): Promise<Checksum> {
	try {
		const axiosConfig: AxiosRequestConfig = {
			headers: {
				Authorization: 'Token ' + origin.apikey,
			},
			url: `${origin.baseUrl}/v2/sdk/apps/${origin.appId}/${origin.appVersion}/checksum`,
			method: 'GET',
		};
		return await requestMakeApi(axiosConfig);
	} catch (err: any) {
		log('warn', `Could not load checksum for components with error ${err.message}`);
	}
	return { modules: [], rpcs: [], functions: [], accounts: [], hooks: [], app: [] };
}

function findOriginComponent(checksums: Checksum | undefined | null, componentType: AppComponentType | AppGeneralType, remoteComponentName: string) {
	if (!checksums) {
		return null;
	}

	let componentChecksum: ComponentChecksum[] = [];
	if (componentType === 'connection') {
		componentChecksum = checksums.accounts;
	} else if (componentType === 'webhook') {
		componentChecksum = checksums.hooks;
	} else if (componentType === 'function') {
		componentChecksum = checksums.functions;
	} else if (componentType === 'module') {
		componentChecksum = checksums.modules;
	} else if (componentType === 'rpc') {
		componentChecksum = checksums.rpcs;
	} else if (componentType === 'app') {
		componentChecksum = checksums.app;
	}

	if (componentType === 'app') {
		return componentChecksum[0].checksum;
	}
	const checksum = componentChecksum.find(checksum => checksum.name === remoteComponentName)?.checksum;
	if (!checksum) {
		return null;
	}
	return checksum;
}

export function findOriginChecksum(checksums: Checksum | undefined | null, componentType: AppComponentType | AppGeneralType, remoteComponentName: string, codeType: CodeType): string[] | null {
	const checksum = findOriginComponent(checksums, componentType, remoteComponentName);
	if (!checksum) {
		log('debug' ,`Not found origin component ${componentType}.`);
		return null;
	}


	const outChecksums: string[] = [];
	if (checksum[codeType]) {
		outChecksums.push(checksum[codeType] || '');
	}

	if (checksum[`${codeType}_jsonc`]) {
		outChecksums.push(checksum[`${codeType}_jsonc`] || '');
	}

	const codeDef = getCodeDef(componentType, codeType);
	if (!codeDef) {
		return outChecksums;
	}

	if (checksum[`${codeDef.apiCodeType}_jsonc`]) {
		outChecksums.push(checksum[`${codeDef.apiCodeType}_jsonc`] || '');
	}

	if (checksum[codeDef.apiCodeType]) {
		outChecksums.push(checksum[codeDef.apiCodeType] || '');
	}

	return outChecksums;
}

export function compareChecksumDeep(originChecksums: Checksum, componentType: AppComponentType, componentRemoteName: string, data: Record<string, any>): boolean {
	const checksum = findOriginComponent(originChecksums, componentType, componentRemoteName);
	if (!checksum) {
		return false;
	}

	const map: Record<string, string> = {
		'label': 'label',
		'description': 'description',
		'typeId': 'type_id',
		'actionCrud': 'crud',
		'crud': 'crud',
		'connection': 'account_name',
		'altConnection': 'alt_account_name',
	};

	for (const key of Object.keys(data)) {
		const originKey = map[key];
		if (!originKey || typeof checksum[originKey] === 'undefined'){
			log('warn', `Not found mapping for '${componentType}.${key}'.`);
			return false;
		}

		// Values are null. Match.
		if (checksum[originKey] === null && data[key] === null) {
			continue;
		}

		// Checksum is same
		if (data[originKey] !== null && md5(data[key].toString()) === checksum[originKey]) {
			continue;
		}

		return false;
	}

	return true;
}
