import { getOriginObject } from './get-origin-object';
import { ComponentIdMappingItem, LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';
import { AppComponentType, AppComponentTypes, AppGeneralType } from '../../types/app-component-type.types';

/**
 * Provides helping function to find remote component name from local ID and vice versa.
 */
export class ComponentIdMappingHelper {
	constructor(private makecomappJson: MakecomappJson, private origin: LocalAppOrigin) {
	}

	getMappingByLocalName(componentType: AppComponentType | AppGeneralType, localId: string) {
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
		return matchedMappings[0];
	}

	getRemoteName(componentType: AppComponentType | AppGeneralType, localId: string): string | null | undefined {
		const mapping = this.getMappingByLocalName(componentType, localId);
		if (!mapping) {
			return mapping;
		}

		return mapping.remote;
	}

	getExistingRemoteName(componentType: AppComponentType | AppGeneralType, localId: string): string | null {
		const remoteComponentName = this.getRemoteName(componentType, localId);

		if (remoteComponentName === undefined) {
			throw new Error(`No mapping found for local ID "${localId}"`);
		}

		return remoteComponentName;
	}

	/**
	 * Transforms the component reference (in component local ID) to the remote name in format for usable in Make Rest API.
	 * @returns
	 *   String with remote component name that should be set,
	 *   Or `null` for no reference should exists,
	 *   Or `undefined` for "do not change the reference".
	 */
	getComponentReferenceRemoteNameForApiPatch(
		referenceComponentType: AppComponentType,
		referenceComponentLocalId: string | null | undefined,
	): string | undefined | null {
		if (referenceComponentLocalId === null) {
			return null;
		}
		if (referenceComponentLocalId) {
			const referenceRemoteName = this.getExistingRemoteName(referenceComponentType, referenceComponentLocalId);
			if (referenceRemoteName !== null) {
				return referenceRemoteName;
			}
			// else do not update it, because marked for ignoring in component ID mapping.
			return undefined;
		}
	}

	private getMappingByRemoteName(componentType: AppComponentType | AppGeneralType, remoteName: string) {
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

		return matchedMappings[0];
	}

	/**
	 * Retrieves the local ID associated with a given remote name for a specified component type.
	 *
	 * This function searches for a mapping entry based on the `componentType` and `remoteName`.
	 * If a matching entry is found, it returns the `local` ID associated with that mapping.
	 * If no matching mapping exists, it returns `null` or `undefined`.
	 *
	 * @private
	 * @param {AppComponentType | AppGeneralType} componentType - The type of the component or general type to search within the mappings.
	 * @param {string} remoteName - The name of the remote component to find the local ID for.
	 * @returns {string | null | undefined} - The local ID if found, otherwise `null` or `undefined` if no mapping exists.
	 */
	private getLocalId(
		componentType: AppComponentType | AppGeneralType,
		remoteName: string,
	): string | null | undefined {
		const mapping = this.getMappingByRemoteName(componentType, remoteName);
		if (!mapping) {
			return mapping;
		}
		return mapping.local;
	}

	getExistingLocalId(componentType: AppComponentType | AppGeneralType, remoteName: string): string | null {
		const localId = this.getLocalId(componentType, remoteName);

		if (localId === undefined) {
			throw new Error(`No mapping found for remote ${componentType} name "${remoteName}"`);
		}

		return localId;
	}

	addLocalDeleted(componentType: AppComponentType | AppGeneralType, localId: string) {
		const mapping = this.getMappingByLocalName(componentType, localId);
		if (!mapping) {
			return;
		}
		mapping.localDeleted = true;
	}

	/**
	 * Removes a mapping entry for a specified component type based on the remote component name.
	 *
	 * This function finds the specified component type within the `idMapping` of `makecomappJson`
	 * for the given origin. If an entry with a matching remote component name exists,
	 * it is filtered out from the mappings.
	 *
	 * @param {AppComponentType} componentType - The type of the component to target in the mapping.
	 * @param {string} originComponentName - The name of the remote component to remove from the mapping.
	 */
	removeByRemoteName(componentType: AppComponentType, originComponentName: string) {
		const originInMakecomappJson = getOriginObject(this.makecomappJson, this.origin);

		// Modify makecomapp object
		if (originInMakecomappJson.idMapping?.[componentType]) {
			originInMakecomappJson.idMapping[componentType] = originInMakecomappJson.idMapping[componentType].filter(mapping => mapping.remote !== originComponentName);
		}
		// Modify origin object that
		if (this.origin.idMapping?.[componentType]) {
			this.origin.idMapping[componentType] = this.origin.idMapping[componentType].filter(mapping => mapping.remote !== originComponentName);
		}

		return originInMakecomappJson;
	}


	/**
	 * Updates the `idMapping` mapping in `this.makecomappJson`:
	 * Keeps the the only items that matches with defined `filterCondition`, all other items are removed.
	 */
	filterMappingItems(filterCondition: (it: ComponentIdMappingItem) => boolean) {
		const originInMakecomappJson = getOriginObject(this.makecomappJson, this.origin);

		for (const componentType of AppComponentTypes) {
			// Modify makecomapp object
			if (originInMakecomappJson.idMapping?.[componentType]) {
				originInMakecomappJson.idMapping[componentType] = originInMakecomappJson.idMapping[componentType].filter(filterCondition);
			}
			// Modify origin object that
			if (this.origin.idMapping?.[componentType]) {
				this.origin.idMapping[componentType] = this.origin.idMapping[componentType].filter(filterCondition);
			}
		}
	}
}
