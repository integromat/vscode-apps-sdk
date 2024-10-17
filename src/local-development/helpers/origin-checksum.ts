import { Checksum, ComponentChecksum } from '../types/checksum.types';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { CodeType } from '../types/code-type.types';
import { getCodeDef } from '../../services/component-code-def';
import type { AxiosRequestConfig } from 'axios';
import { requestMakeApi } from '../../utils/request-api-make';
import { log } from '../../output-channel';
import { LocalAppOriginWithSecret } from '../types/makecomapp.types';
import { md5 } from './md5';

/**
 * Downloads the checksums for all components from the origin server.
 *
 * @param origin - The origin server configuration including API key and base URL.
 * @returns A Promise that resolves to the checksum data.
 */
export async function downloadOriginChecksums(origin: LocalAppOriginWithSecret): Promise<Checksum> {
	try {
		// Prepare the Axios request configuration with authorization header
		const axiosConfig: AxiosRequestConfig = {
			headers: {
				Authorization: 'Token ' + origin.apikey,
			},
			url: `${origin.baseUrl}/v2/sdk/apps/${origin.appId}/${origin.appVersion}/checksum`,
			method: 'GET',
		};
		// Make the API request to download checksums
		return await requestMakeApi(axiosConfig);
	} catch (err: any) {
		// Throw an error if the checksum cannot be loaded
		throw new Error(`Could not load checksum for components with error ${err.message}`);
	}
}

/**
 * Retrieves an array of component checksums based on the component type.
 *
 * @param checksums - The checksum data containing checksums for various components.
 * @param componentType - The type of component to retrieve checksums for.
 * @returns An array of ComponentChecksum objects.
 */
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

/**
 * Retrieves the checksum record for a specific component.
 *
 * @param componentChecksums - An array of ComponentChecksum objects.
 * @param componentType - The type of the component.
 * @param remoteComponentName - The name of the component to find.
 * @returns The checksum record for the component or null if not found.
 */
function getChecksumForComponent(
	componentChecksums: ComponentChecksum[],
	componentType: AppComponentType | AppGeneralType,
	remoteComponentName?: string,
): Record<string, string | null> | undefined {
	if (componentType === 'app') {
		// For 'app' type, return the checksum of the first element
		return componentChecksums[0]?.checksum || undefined;
	}
	// Find the component checksum matching the remote component name
	const checksum = componentChecksums.find((checksum) => checksum.name === remoteComponentName)?.checksum;
	return checksum || undefined;
}

/**
 * Finds the checksum record for a component from the origin checksums.
 *
 * @param checksums - The checksum data from the origin.
 * @param componentType - The type of the component.
 * @param remoteComponentName - The name of the remote component.
 * @returns The checksum record or null if not found.
 */
export function findOriginComponent(
	checksums: Checksum | undefined | null,
	componentType: AppComponentType | AppGeneralType,
	remoteComponentName?: string,
): Record<string, string | null> | undefined {
	if (!checksums) {
		return undefined;
	}

	// Get the array of checksums for the specified component type
	const componentChecksums = getComponentChecksumArray(checksums, componentType);
	// Get the checksum for the specific component
	return getChecksumForComponent(componentChecksums, componentType, remoteComponentName);
}

/**
 * Finds and returns an array of checksums for specific code types of a component.
 *
 * @param checksums - The checksum data from the origin.
 * @param componentType - The type of the component.
 * @param remoteComponentName - The name of the remote component.
 * @param codeType - The type of code (e.g., 'code', 'schema').
 * @returns An array of checksums or null if not found.
 */
export function findOriginChecksum(
	checksums: Checksum | undefined | null,
	componentType: AppComponentType | AppGeneralType,
	remoteComponentName: string,
	codeType: CodeType,
): string[] | null {
	// Find the checksum record for the component
	const checksum = findOriginComponent(checksums, componentType, remoteComponentName);
	if (!checksum) {
		log('debug', `Not found origin component ${componentType}.`);
		return null;
	}

	const outChecksums: string[] = [];
	// Add the checksum for the specified code type if it exists
	if (checksum[codeType]) {
		outChecksums.push(checksum[codeType] || '');
	}

	// Add the checksum for the JSONC variant of the code type if it exists
	if (checksum[`${codeType}_jsonc`]) {
		outChecksums.push(checksum[`${codeType}_jsonc`] || '');
	}

	// Get the code definition for the component and code type
	const codeDef = getCodeDef(componentType, codeType);
	if (!codeDef) {
		return outChecksums;
	}

	// Add the checksum for the API code type JSONC variant if it exists
	if (checksum[`${codeDef.apiCodeType}_jsonc`]) {
		outChecksums.push(checksum[`${codeDef.apiCodeType}_jsonc`] || '');
	}

	// Add the checksum for the API code type if it exists
	if (checksum[codeDef.apiCodeType]) {
		outChecksums.push(checksum[codeDef.apiCodeType] || '');
	}

	if (outChecksums.length === 0) {
		log(
			'warn',
			`Some field was not found in checksum list componentType=${componentType} codeType=${codeType}, apiCodeType=${codeDef.apiCodeType}`,
		);
	}

	return outChecksums;
}

/**
 * Compares the local componentMetadataToUpdate with the origin checksums to determine if they match.
 *
 * @param originChecksums - The checksum componentMetadataToUpdate from the origin.
 * @param componentType - The type of the component.
 * @param componentRemoteName - The name of the remote component.
 * @param componentMetadataToUpdate - The local componentMetadataToUpdate to compare.
 * @returns True if the componentMetadataToUpdate matches the origin checksum, false otherwise.
 */
export function compareChecksumDeep(
	originChecksums: Checksum,
	componentType: AppComponentType,
	componentRemoteName: string,
	componentMetadataToUpdate: Record<string, any>,
): boolean {
	// Find the checksum record for the component
	const checksum = findOriginComponent(originChecksums, componentType, componentRemoteName);
	if (!checksum) {
		return false;
	}

	// Mapping of local componentMetadataToUpdate keys to checksum keys
	const localDataKeyToRemoteKeyMap: Record<string, string> = {
		label: 'label',
		description: 'description',
		typeId: 'type_id',
		actionCrud: 'crud',
		crud: 'crud',
		connection: 'account_name',
		altConnection: 'alt_account_name',
	};

	// Iterate over the keys in the local componentMetadataToUpdate
	for (const key of Object.keys(componentMetadataToUpdate)) {
		const originKey = localDataKeyToRemoteKeyMap[key];
		if (!originKey || typeof checksum[originKey] === 'undefined') {
			log('warn', `Not found mapping for '${componentType}.${key}'.`);
			return false;
		}

		// If both values are null, they match
		if (checksum[originKey] === null && componentMetadataToUpdate[key] === null) {
			continue;
		}

		// Compare the MD5 hash of the local componentMetadataToUpdate value with the checksum
		if (
			componentMetadataToUpdate[originKey] !== null &&
			md5(String(componentMetadataToUpdate[key])) === checksum[originKey]
		) {
			continue;
		}

		// If any value doesn't match, return false
		return false;
	}

	// All values match
	return true;
}
