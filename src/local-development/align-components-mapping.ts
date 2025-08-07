import * as vscode from 'vscode';
import type {
	AppComponentMetadataRemoteIDs,
	AppComponentMetadataWithCodeFiles,
	LocalAppOriginWithSecret,
} from './types/makecomapp.types';
import { addComponentIdMapping } from './makecomappjson';
import { askForSelectMappedComponent, specialAnswers } from './ask-mapped-component';
import { createRemoteAppComponent } from './create-remote-component';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { createLocalEmptyComponent } from './create-local-empty-component';
import type { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { deleteOriginComponent } from './delete-origin-component';
import type { Checksum } from './types/checksum.types';
import { getComponentChecksumArray } from './helpers/origin-checksum';
import { convertComponentMetadataRemoteNamesToLocalIds, getRemoteComponent } from './remote-components-summary';
import { MakecomappJsonFile } from './helpers/makecomapp-json-file-class';

// Components that can be non owned by app.
export const COMPONENTS_CAN_BE_NON_OWNED = ['connection', 'webhook'];

/**
 * Checks if the component is not owned by the app.
 * This is used to determine if the component can be created as non-owned.
 * 
 * @param componentName - The name of the component.
 * @param componentType - The type of the component.
 * @param originChecksums - The checksums of the origin.
 * @return {boolean} - Returns true if the component is not owned by the app, false otherwise.
 */
export function isNotOwnedByApp(
	componentName: string | null,
	componentType: AppComponentType | 'app',
	originChecksums: Checksum,
): boolean {
	switch (componentType) {
		case 'connection':
			return originChecksums.accounts.some((connection) => connection.name === componentName && connection.external);
		case 'webhook':
			return originChecksums.hooks.some((webhook) => webhook.name === componentName && webhook.external)
		default:
			return false; // Other components are always owned by app.
	}
}


/**
 * Compares list of components from two sources. If some component is missing on one side,
 * it is created and paired in mapping, or original component is marked for ignoring.
 *
 * If local or remote component is created on ond site, the codes are not synced (deployed or pulled).
 * This function has purpose to align (create) components itself only, but not sync theirs codes.
 * Explanation: It is because this function is designed to be called from "deploy" or "push" functions,
 * where the deployment or push is alredy handled itself.
 *
 * IMPORTANT: Changes the `makecomapp.json` file.
 */
export async function alignComponentsMapping(
	makecomappRootDir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	originChecksums: Checksum,
	newLocalComponentResolution: 'askUser' | 'ignore',
	newRemoteComponentResolution: 'askUser' | 'cloneAsNew' | 'ignore',
): Promise<void> {
	let makecomappJsonFile = await MakecomappJsonFile.fromLocalProject(makecomappRootDir);

	/**
	 * Existing in `makecomappJson`, missing in `remoteComponents`
	 * Common meaning: New local component, which not exists in remote Make yet.
	 */
	let localOnly: {
		componentType: AppComponentType;
		componentLocalId: string;
		componentMetadata: AppComponentMetadataWithCodeFiles;
	}[] = [];
	/**
	 * Missing in `makecomappJson`, but existing in `remoteComponents`.
	 * Common meaning: Missing in local components, existing in remote Make.
	 */
	let remoteOnly: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadataRemoteIDs;
	}[] = [];
	/**
	 * Deleted locally: Missing in local filesystem, but existing in `remoteComponents` and existing in 'mapping' with 'localDeleted: true'.
	 * Common meaning: Deleted locally, but still exists in the remote Make.
	 */
	const deletedLocally: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadataRemoteIDs;
	}[] = [];

	// Fill `remoteOnly`
	const allComponentTypes: AppComponentType[] = ['connection', 'webhook', 'module', 'rpc', 'function'];
	for (const componentType of allComponentTypes) {
		const checksums = getComponentChecksumArray(originChecksums, componentType);
		const originNames = checksums.map((checksum) => {
			return checksum.name;
		});
		for (const componentName of originNames) {
			const isLocalComponentKnown = origin.idMapping?.[componentType]?.find(
				(idMappingItem) => idMappingItem.remote === componentName,
			);

			// Component was deleted locally. Still need to remove from origin.
			if (isLocalComponentKnown && isLocalComponentKnown.localDeleted) {
				const componentMetadata = await getRemoteComponent(origin, componentType, componentName);
				deletedLocally.push({
					componentType,
					componentName,
					componentMetadata,
				});
			}

			if (isLocalComponentKnown === undefined) {
				const componentMetadata = await getRemoteComponent(origin, componentType, componentName);
				remoteOnly.push({
					componentType,
					componentName,
					componentMetadata,
				});
			}
		}
	}

	// Fill `localOnly`
	for (const [componentType, components] of entries(makecomappJsonFile.content.components)) {
		const componentIdMapping = new ComponentIdMappingHelper(makecomappJsonFile.content, origin);

		for (const [componentLocalId, componentMetadata] of entries(components)) {
			if (componentMetadata === null) {
				// Not a fully existing component, but the reserved ID only. Ignore.
				continue;
			}
			if (componentIdMapping.getRemoteName(componentType, componentLocalId) === undefined) {
				// Local component is not linked to remote
				localOnly.push({
					componentType,
					componentLocalId: componentLocalId,
					componentMetadata,
				});
			}
		}
	}

	/*
	 * Whole list of `localOnly` + `remoteOnly` will be processed (aligned) now.
	 *
	 * Note: The order is important here.
	 *       Connections and webhooks must be created first, because modules and RPCs can references on them,
	 *       and it means that referenced webhooks/connections must already exists in time of referencing component creation.
	 */
	const componentsProcessingOrder: AppComponentType[] = ['connection', 'webhook', 'module', 'rpc', 'function'];
	/** Stores the user's preference for case of answer "apply for all". */
	let userPreferedResolutionOfUnmappedLocal: symbol | undefined = undefined;
	/** Stores the user's preference for case of answer "apply for all". */
	let userPreferedResolutionOfUnmappedRemote: symbol | undefined = undefined;

	for (const componentType of componentsProcessingOrder) {
		const localOnlyInSpecificComponentType = localOnly.filter(
			(component) => component.componentType === componentType,
		);
		const remoteOnlyInSpecificComponentType = remoteOnly.filter(
			(component) => component.componentType === componentType,
		);
		const deletedLocallyInSpecificComponentType = deletedLocally.filter(
			(component) => component.componentType === componentType,
		);

		// Resolve locally deleted components
		let deletedLocallyComponent;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		while ((deletedLocallyComponent = deletedLocallyInSpecificComponentType.shift()!)) {
			await deleteOriginComponent(origin, componentType, deletedLocallyComponent.componentName);
			const mappingHelper = makecomappJsonFile.getComponentIdMappingHelper(origin);
			mappingHelper.removeByRemoteName(componentType, deletedLocallyComponent.componentName);
			await makecomappJsonFile.saveChanges();
		}

		// Resolve 'localOnly' found components
		if (newLocalComponentResolution !== 'ignore') {
			// Ask user to link `localOnly` component(s) with unlinked remote, or create new remote component
			let localOnlyComponent: (typeof localOnlyInSpecificComponentType)[0];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			while ((localOnlyComponent = localOnlyInSpecificComponentType.shift()!)) {
				// Local component is not linked to remote

				progresDialogReport('Asking user for additional information (see dialog on the top)');

				let actionToProcess:
					| {
							name: 'deployAsNew';
					  }
					| {
							name: 'mapWith';
							conterpartyComponentID: string | null;
					  };

				// Step 1: Ask for "Select remote component, which should be linked with. Or new component will be created."
				const unlinkedComponents = remoteOnly.filter(
					(remoteComponent) => remoteComponent.componentType === localOnlyComponent.componentType,
				);

				if (newLocalComponentResolution === 'askUser') {
					const userAnswer =
						(userPreferedResolutionOfUnmappedLocal && unlinkedComponents.length) === 0
							? // Use prefered solution if no unlinked components left only
							  userPreferedResolutionOfUnmappedLocal
							: // Ask user for the his preferences in all other cases
							  await askForSelectMappedComponent(
									'local',
									localOnlyComponent.componentType,
									localOnlyComponent.componentLocalId,
									localOnlyComponent.componentMetadata.label,
									unlinkedComponents,
							  );
					if (typeof userAnswer === 'string') {
						actionToProcess = { name: 'mapWith', conterpartyComponentID: userAnswer };
					} else {
						switch (userAnswer) {
							case specialAnswers.CREATE_NEW_COMPONENT:
								actionToProcess = { name: 'deployAsNew' };
								break;
							case specialAnswers.CREATE_NEW_COMPONENT__FOR_ALL:
								userPreferedResolutionOfUnmappedLocal = specialAnswers.CREATE_NEW_COMPONENT;
								actionToProcess = { name: 'deployAsNew' };
								break;
							case specialAnswers.MAP_WITH_NULL:
								actionToProcess = { name: 'mapWith', conterpartyComponentID: null };
								break;
							case specialAnswers.MAP_WITH_NULL__FOR_ALL:
								userPreferedResolutionOfUnmappedLocal = specialAnswers.MAP_WITH_NULL;
								actionToProcess = { name: 'mapWith', conterpartyComponentID: null };
								break;
							default:
								throw new Error(`Unknown special answer "${userAnswer?.description}"`);
						}
					}
				} else {
					throw new Error(
						`Unknown function parameter newLocalComponentResolution = ${newLocalComponentResolution}`,
					);
				}

				// Step 2: Execute the action selected in step 1
				progresDialogReport('Processing the component alignemnt');
				switch (actionToProcess.name) {
					case 'mapWith':
						// Link internal ID with already existing remote component.
						await addComponentIdMapping(
							localOnlyComponent.componentType,
							localOnlyComponent.componentLocalId,
							actionToProcess.conterpartyComponentID,
							isNotOwnedByApp(
								actionToProcess.conterpartyComponentID,
								localOnlyComponent.componentType,
								originChecksums,
							), // can be non-owned by app when deploying to another app version, // in mapping with existing remote is always owned by app
							makecomappRootDir,
							origin,
						);

						// Remove newly linked component from `remoteOnly`.
						remoteOnly = remoteOnly.filter(
							(component) =>
								component.componentType !== localOnlyComponent.componentType ||
								component.componentName !== actionToProcess.conterpartyComponentID,
						);

						// Note: Now, the local component is fully linked with existing remote.
						break;

					case 'deployAsNew':
						{
							// Create new remote compoments (becuse it not exist)
							const newRemoteComponentName = await createRemoteAppComponent({
								appName: origin.appId,
								appVersion: origin.appVersion,
								componentType: localOnlyComponent.componentType,
								componentMetadata: localOnlyComponent.componentMetadata,
								componentName: localOnlyComponent.componentLocalId,
								makecomappJson: makecomappJsonFile.content,
								origin,
							});

							/* Skipped here: Deploy local codes to new remote component.
							 * Skipped here: Deploy also other configuration (connection, altConnection, webhook).
							 *   It is because this section is called by "pullAllComponents()",
							 *   where this skipped step is handled by parent itself. */

							// Add new remote component to idMapping (link with existing local component).
							await addComponentIdMapping(
								localOnlyComponent.componentType,
								localOnlyComponent.componentLocalId,
								newRemoteComponentName,
								false, // can be non-owned by app when deploying to another app version
								makecomappRootDir,
								origin,
							);
						}
						break;
					default:
						throw new Error(`Unknown actionToProcess "${(actionToProcess as any)?.name}"`);
				}
			}
		}

		// Resolve 'remoteOnly' found components
		if (newRemoteComponentResolution !== 'ignore') {
			// Ask user to link `remoteOnly` component(s) with unlinked local, or pull as new local compoment
			let remoteOnlyComponent: (typeof remoteOnlyInSpecificComponentType)[0];
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			while ((remoteOnlyComponent = remoteOnlyInSpecificComponentType.shift()!)) {
				// Remote component is not linked to local

				const notOwnedByApp = isNotOwnedByApp(remoteOnlyComponent.componentName, componentType, originChecksums);

				progresDialogReport('Asking user for additional information (see dialog on the top)');

				let actionToProcess:
					| {
							name: 'cloneAsNew';
					  }
					| {
							name: 'mapWith';
							conterpartyComponentID: string | null;
					  };

				// Step 1: Ask for "Select remote component, which should be linked with. Or new component will be created."
				const unlinkedComponents = localOnly
					.filter((localComponent) => localComponent.componentType === remoteOnlyComponent.componentType)
					.map((localComponent) => ({
						componentName: localComponent.componentLocalId,
						componentMetadata: localComponent.componentMetadata,
					}));

				switch (newRemoteComponentResolution) {
					case 'askUser': {
						const userAnswer =
							userPreferedResolutionOfUnmappedRemote && unlinkedComponents.length === 0
								? // Use prefered solution if no unlinked components left only
								  userPreferedResolutionOfUnmappedRemote
								: // Ask user for the his preferences in all other cases
								  await askForSelectMappedComponent(
										'remote',
										remoteOnlyComponent.componentType,
										remoteOnlyComponent.componentName,
										remoteOnlyComponent.componentMetadata.label,
										unlinkedComponents,
								  );
						if (typeof userAnswer === 'string') {
							actionToProcess = { name: 'mapWith', conterpartyComponentID: userAnswer };
						} else {
							switch (userAnswer) {
								case specialAnswers.CREATE_NEW_COMPONENT:
									actionToProcess = { name: 'cloneAsNew' };
									break;
								case specialAnswers.CREATE_NEW_COMPONENT__FOR_ALL:
									userPreferedResolutionOfUnmappedRemote = specialAnswers.CREATE_NEW_COMPONENT;
									actionToProcess = { name: 'cloneAsNew' };
									break;
								case specialAnswers.MAP_WITH_NULL:
									actionToProcess = { name: 'mapWith', conterpartyComponentID: null };
									break;
								case specialAnswers.MAP_WITH_NULL__FOR_ALL:
									userPreferedResolutionOfUnmappedRemote = specialAnswers.MAP_WITH_NULL;
									actionToProcess = { name: 'mapWith', conterpartyComponentID: null };
									break;
								default:
									throw new Error(`Unknown special answer "${userAnswer?.description}"`);
							}
						}
						break;
					}
					case 'cloneAsNew':
						actionToProcess = { name: 'cloneAsNew' };
						break;
					// Note: `case 'ignore':` skipped by parent `if` condition
					default:
						throw new Error(
							`Unknown function parameter newRemoteComponentResolution = ${newRemoteComponentResolution}`,
						);
				}

				// Step 2: Execute the action selected in step 1
				progresDialogReport('Processing the component alignemnt');
				switch (actionToProcess.name) {
					case 'mapWith':
						// Link internal ID with already existing remote component.
						await addComponentIdMapping(
							remoteOnlyComponent.componentType,
							actionToProcess.conterpartyComponentID,
							remoteOnlyComponent.componentName,
							notOwnedByApp, // mapped item is always owned by app
							makecomappRootDir,
							origin,
						);

						// Remove newly linked component from `localOnly`.
						localOnly = localOnly.filter(
							(component) =>
								component.componentType !== remoteOnlyComponent.componentType ||
								component.componentLocalId !== undefined,
						);

						// Note: Now, the remote component is fully linked with existing local.
						break;

					case 'cloneAsNew':
						{
							// Create new empty local component
							const newComponent = await createLocalEmptyComponent(
								remoteOnlyComponent.componentType,
								// as the non-owned connection can have different name from component name, which is the case on what createLocalEmptyComponent() relies
								COMPONENTS_CAN_BE_NON_OWNED.includes(remoteOnlyComponent.componentType) &&
									notOwnedByApp
									? ''
									: remoteOnlyComponent.componentName,
								await convertComponentMetadataRemoteNamesToLocalIds(
									remoteOnlyComponent.componentMetadata,
									makecomappJsonFile.getComponentIdMappingHelper(origin),
									makecomappJsonFile,
									origin,
								),
								makecomappRootDir,
								notOwnedByApp,
							);

							/* Skipped here: Pull existing codes to new local component
							 *   It is because this section is called by "pullAllComponents()",
							 *   where this skipped step is handled by parent itself. */

							// Link it with existing remote component
							await addComponentIdMapping(
								remoteOnlyComponent.componentType,
								newComponent.componentLocalId,
								remoteOnlyComponent.componentName,
								notOwnedByApp,
								makecomappRootDir,
								origin,
							);
						}
						break;
					default:
						throw new Error(`Unknown actionToProcess`);
				}
			}
		}
		// Because the ID mapping was probably updated by `addComponentIdMapping()` execution above,
		// it is needed to refresh the `makecomappJsonFile` variable with the fresh data.
		// Pls note there are used two ways of persisting changes inside of methods
		// (via class MakecomappJsonFile and method `updateMakecomappJson`).
		makecomappJsonFile = await MakecomappJsonFile.fromLocalProject(makecomappRootDir);
	}
	progresDialogReport('');
}