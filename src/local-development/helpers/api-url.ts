import type { LocalAppOriginWithSecret } from '../types/makecomapp.types';
import * as Core from '../../Core';
import type { AppComponentType } from '../../types/app-component-type.types';

const apiV2SdkAppsBasePath = 'v2/sdk/apps';

/**
 * Gets endpoint URL for CRUD of the the given component.
 * If `remoteComponentName` is `undefined`, returns the url for component creation.
 */
export function getComponentApiUrl({
	componentType,
	remoteComponentName,
	origin,
}: {
	componentType: AppComponentType | 'app';
	remoteComponentName: string | undefined;
	origin: LocalAppOriginWithSecret;
}): string {
	// Compose directory structure
	let url = `${origin.baseUrl}/${apiV2SdkAppsBasePath}`;

	// Add version to URN for versionable items
	if (Core.isVersionable(componentType)) {
		url += `/${origin.appId}/${origin.appVersion}`;
	} else if (!remoteComponentName) {
		// Case URL:
		//  1. list of all existing components
		//  2. New component creation POST URL
		url += `/${origin.appId}`;
	}

	// Complete the URN by the type of item
	switch (componentType) {
		case 'connection':
		case 'webhook':
		case 'module':
		case 'rpc':
		case 'function':
			return url + `/${componentType}s` + (remoteComponentName ? `/${remoteComponentName}` : '');
		// Base, common, readme, group
		case 'app':
			return url;
		default:
			throw new Error(`Unsupported component type: ${componentType} in getComponentApiUrl().`);
	}
}
