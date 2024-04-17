import { LocalAppOriginWithSecret } from '../types/makecomapp.types';
import * as Core from '../../Core';
import { AppComponentType } from '../../types/app-component-type.types';

const ENVIRONMENT_VERSION = 2;

/**
 * Gets endpoint URL for CRUD of the the given component.
 * If `remoteComponentName` is `undefined`, returns the url for component creation.
 */
export function getComponentApiUrl({
	appComponentType,
	remoteComponentName,
	origin,
}: {
	appComponentType: AppComponentType | 'app';
	remoteComponentName: string | undefined;
	origin: LocalAppOriginWithSecret;
}): string {
	// Compose directory structure
	let url = `${origin.baseUrl}/v2/${Core.pathDeterminer(ENVIRONMENT_VERSION, '__sdk')}${Core.pathDeterminer(
		ENVIRONMENT_VERSION,
		'app',
	)}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(appComponentType)) {
		url += `/${origin.appId}/${origin.appVersion}`;
	}

	// Complete the URN by the type of item
	switch (appComponentType) {
		case 'connection':
		case 'webhook':
		case 'module':
		case 'rpc':
		case 'function':
			return url + `/${appComponentType}s` + (remoteComponentName ? `/${remoteComponentName}` : '');
			break;
		// Base, common, readme, group
		case 'app':
			return url;
		default:
			throw new Error(`Unsupported component type: ${appComponentType} in getComponentApiUrl().`);
	}
}
