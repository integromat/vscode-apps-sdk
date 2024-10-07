import { Checksum, ComponentChecksum } from '../types/checksum.types';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeType } from '../types/code-type.types';
import { getCodeDef } from '../code-pull-deploy';
import type { AxiosRequestConfig } from 'axios';
import { requestMakeApi } from '../../utils/request-api-make';
import { log } from '../../output-channel';
import { LocalAppOriginWithSecret } from '../types/makecomapp.types';
import { md5 } from './md5';

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
		throw new Error(`Could not load checksum for components with error ${err.message}`)
	}
}

export function getComponentChecksumArray(
	checksums: Checksum,
	componentType: AppComponentType | AppGeneralType,
): ComponentChecksum[] {
	switch (componentType) {
		case 'connection':
			return checksums.accounts;
		case 'webhook':
			return checksums.hooks;
		case 'function':
			return checksums.functions;
		case 'module':
			return checksums.modules;
		case 'rpc':
			return checksums.rpcs;
		case 'app':
			return checksums.app;
		default:
			return [];
	}
}

function getChecksumForComponent(
	componentChecksums: ComponentChecksum[],
	componentType: AppComponentType | AppGeneralType,
	remoteComponentName?: string,
): Record<string, string | null> | null {
	if (componentType === 'app') {
		return componentChecksums[0]?.checksum || null;
	}
	const checksum = componentChecksums.find(
		(checksum) => checksum.name === remoteComponentName,
	)?.checksum;
	return checksum || null;
}

export function findOriginComponent(
	checksums: Checksum | undefined | null,
	componentType: AppComponentType | AppGeneralType,
	remoteComponentName?: string,
): Record<string, string | null> | null {
	if (!checksums) {
		return null;
	}

	const componentChecksums = getComponentChecksumArray(checksums, componentType);
	return getChecksumForComponent(
		componentChecksums,
		componentType,
		remoteComponentName,
	);
}

export function findOriginChecksum(checksums: Checksum | undefined | null, componentType: AppComponentType | AppGeneralType, remoteComponentName: string, codeType: CodeType): string[] | null {
	const checksum = findOriginComponent(checksums, componentType, remoteComponentName);
	if (!checksum) {
		log('debug', `Not found origin component ${componentType}.`);
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

	if (outChecksums.length === 0){
		log('warn', `Some field was not found in checksum list componentType=${componentType} codeType=${codeType}, apiCodeType=${codeDef.apiCodeType}`);
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
		if (!originKey || typeof checksum[originKey] === 'undefined') {
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
