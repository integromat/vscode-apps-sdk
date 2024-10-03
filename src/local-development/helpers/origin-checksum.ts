import { Checksum, ComponentChecksum } from '../types/checksum.types';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeType } from '../types/code-type.types';
import { getCodeDef } from '../code-pull-deploy';
import type { AxiosRequestConfig } from 'axios';
import { requestMakeApi } from '../../utils/request-api-make';
import { log } from '../../output-channel';
import { LocalAppOriginWithSecret } from '../types/makecomapp.types';

export async function downloadOriginChecksums(origin: LocalAppOriginWithSecret) {
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
	return { modules: [], rpcs: [], functions: [], accounts: [], hooks: [] };
}

export function findOriginChecksum(checksums: Checksum | undefined | null, componentType: AppComponentType | AppGeneralType, remoteComponentName: string, codeType: CodeType): string[] | null {
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
	}
	const checksum = componentChecksum.find(checksum => checksum.name === remoteComponentName)?.checksum;
	if (!checksum) {
		return null;
	}

	const codeDef = getCodeDef(componentType, codeType);
	if (!codeDef) {
		return null;
	}

	const outChecksums: string[] = [];
	if (checksum[`${codeDef.apiCodeType}_jsonc`]) {
		outChecksums.push(checksum[`${codeDef.apiCodeType}_jsonc`] || '');
	}

	if (checksum[codeDef.apiCodeType]) {
		outChecksums.push(checksum[codeDef.apiCodeType]  || '');
	}

	return outChecksums;
}
