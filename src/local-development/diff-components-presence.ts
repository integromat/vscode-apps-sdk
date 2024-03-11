import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentTypesMetadata,
	LocalAppOrigin,
	MakecomappJson,
} from './types/makecomapp.types';
import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';
import { addComponentIdMapping, getLocalIdToRemoteComponentNameMapping } from './makecomappjson';

/**
 * Compares list of components from two sources and returns,
 * which components are new and which are misssing in `allComponents`.
 */
export async function diffComponentsPresence(
	makecomappJson: MakecomappJson,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOrigin,
	// allComponents: AppComponentTypesMetadata<AppComponentMetadata>,
	remoteComponents: AppComponentTypesMetadata<AppComponentMetadata>, // reference
): Promise<{
	/**
	 * Existing in `makecomappJson`, missing in `remoteComponents`
	 * Common meaning: New local component, which not exists in remote Make yet.
	 */
	localOnly: {
		componentType: AppComponentType;
		componentLocalId: string;
		componentMetadata: AppComponentMetadata;
	}[];
	/**
	 * Missing in `makecomappJson`, but existing in `remoteComponents`.
	 * Common meaning: Missing in local components, existing in remote Make.
	 */
	remoteOnly: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadata;
	}[];
}> {
	const ret: Awaited<ReturnType<typeof diffComponentsPresence>> = {
		localOnly: [],
		remoteOnly: [],
	};

	// Fill `newComponents`
	for (const [componentType, components] of entries(makecomappJson.components)) {
		const localToRemoteMapping = getLocalIdToRemoteComponentNameMapping(componentType, makecomappJson, origin);

		for (const [componentLocalId, componentMetadata] of entries(components)) {
			if (localToRemoteMapping[componentLocalId] === undefined) {
				// Local component is not linked to remote

				// Ask for "Select remote component, which should be linked with. Or new component will be created."
				const unlinkedComponponentNames = ret.remoteOnly
					.filter((remoteComponent) => remoteComponent.componentType === componentType)
					.map((remoteComponent) => remoteComponent.componentName);
				const selectedRemoteComponentName: string | '' | undefined = await askForSelectLinkedComponent(
					unlinkedComponponentNames,
				);

				if (selectedRemoteComponentName) {
					// Link internal ID with already existing remote component.
					await addComponentIdMapping(
						componentType,
						componentLocalId,
						selectedRemoteComponentName,
						anyProjectPath,
						origin,
					);
					// Now, the component is linked with existing remote.
				} else if (selectedRemoteComponentName === '') {
					// New component will be created in remote
					ret.localOnly.push({
						componentType,
						componentLocalId: componentLocalId,
						componentMetadata,
					});
				} else if (selectedRemoteComponentName === undefined) {
					throw new Error('Cancelled by user.');
				}
			}
		}
	}

	// Fill `missingComponents`
	for (const [componentType, components] of entries(remoteComponents)) {
		for (const [componentName, componentMetadata] of entries(components)) {
			const isLocalComponentKnown = origin.idMapping[componentType].find(
				(idMappingItem) => idMappingItem.remote === componentName,
			);
			if (isLocalComponentKnown === undefined) {
				ret.remoteOnly.push({
					componentType,
					componentName,
					componentMetadata,
				});
			}
		}
	}

	return ret;
}
