import { getOriginObject } from './get-origin-object';
import { LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

export class ComponentIdMappingHelper {
	constructor(private makecomappJson: MakecomappJson, private origin: LocalAppOrigin) {}

	getRemoteName(componentType: AppComponentType | AppGeneralType, localId: string): string | null | undefined {
		if (componentType === 'app') {
			// This is special case, where "Common", "Readme" (etc.) are considered as members of virtual "app" compoment type, which has single component with ID ``.
			return '';
		}

		const originInMakecomappJson = getOriginObject(this.makecomappJson, this.origin);

		const matchedMappings =
			originInMakecomappJson.idMapping?.[componentType].filter((mapping) => mapping.local === localId) ?? [];

		if (matchedMappings.length === 0) {
			return undefined;
		}

		if (matchedMappings.length >= 2) {
			throw new Error(`Not unique mapping found for local ID "${localId}"`);
		}

		return matchedMappings[0].remote;
	}

	getRemoteNameStrict(componentType: AppComponentType | AppGeneralType, localId: string): string | null {
		const remoteComponentName = this.getRemoteName(componentType, localId);

		if (remoteComponentName === undefined) {
			throw new Error(`No mapping found for local ID "${localId}"`);
		}

		return remoteComponentName;
	}

	getLocalId(componentType: AppComponentType | AppGeneralType, remoteName: string): string | null | undefined {
		if (componentType === 'app') {
			// This is special case, where "Common", "Readme" (etc.) are considered as members of virtual "app" compoment type, which has single component with ID ``.
			return '';
		}

		const originInMakecomappJson = getOriginObject(this.makecomappJson, this.origin);

		const matchedMappings =
			originInMakecomappJson.idMapping?.[componentType].filter((mapping) => mapping.remote === remoteName) ?? [];

		if (matchedMappings.length === 0) {
			return undefined;
		}

		if (matchedMappings.length >= 2) {
			throw new Error(`Not unique mapping found for remote name "${remoteName}"`);
		}

		return matchedMappings[0].local;
	}

	getLocalIdStrict(componentType: AppComponentType | AppGeneralType, remoteName: string): string | null {
		const localId = this.getLocalId(componentType, remoteName);

		if (localId === undefined) {
			throw new Error(`No mapping found for remote name "${remoteName}"`);
		}

		return localId;
	}
}
