import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentTypesMetadata,
	LocalAppOriginWithSecret,
	MakecomappJson,
} from './types/makecomapp.types';
import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';
import { addComponentIdMapping, getLocalIdToRemoteComponentNameMapping } from './makecomappjson';
import { anwersSpecialCases, askForSelectLinkedComponent } from './dialog-select-linked-component';
import { progresDialogReport } from '../utils/vscode-progress-dialog';
import { createRemoteAppComponent } from './create-remote-component';
/**
 * Compares list of components from two sources. If some component is missing on one side,
 * it is created and paired in mapping, or original component is marked for ignorring.
 */
export async function alignComponentMapping(
	makecomappJson: MakecomappJson,
	anyProjectPath: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	remoteComponents: AppComponentTypesMetadata<AppComponentMetadata>,
): Promise<void> {
	/**
	 * Existing in `makecomappJson`, missing in `remoteComponents`
	 * Common meaning: New local component, which not exists in remote Make yet.
	 */
	let localOnly: {
		componentType: AppComponentType;
		componentLocalId: string;
		componentMetadata: AppComponentMetadata;
	}[] = [];
	/**
	 * Missing in `makecomappJson`, but existing in `remoteComponents`.
	 * Common meaning: Missing in local components, existing in remote Make.
	 */
	let remoteOnly: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadata;
	}[] = [];

	// Fill `remoteOnly`
	for (const [componentType, components] of entries(remoteComponents)) {
		for (const [componentName, componentMetadata] of entries(components)) {
			const isLocalComponentKnown = origin.idMapping[componentType].find(
				(idMappingItem) => idMappingItem.remote === componentName,
			);
			if (isLocalComponentKnown === undefined) {
				remoteOnly.push({
					componentType,
					componentName,
					componentMetadata,
				});
			}
		}
	}

	// Fill `localOnly`
	for (const [componentType, components] of entries(makecomappJson.components)) {
		const localToRemoteMapping = getLocalIdToRemoteComponentNameMapping(componentType, makecomappJson, origin);

		for (const [componentLocalId, componentMetadata] of entries(components)) {
			if (localToRemoteMapping[componentLocalId] === undefined) {
				// Local component is not linked to remote
				localOnly.push({
					componentType,
					componentLocalId: componentLocalId,
					componentMetadata,
				});
			}
		}
	}

	// Ask user to link `localOnly` component(s) with unlinked remote, or create new remote component
	let localOnlyComponent: typeof localOnly[0];
	while (localOnlyComponent = localOnly.shift()!) {
		// TODO refactor to WHILE of SHIFT.
		// Local component is not linked to remote

		progresDialogReport('Asking user for additional information (see dialog on the top)');

		// Ask for "Select remote component, which should be linked with. Or new component will be created."
		const unlinkedComponents = remoteOnly.filter(
			(remoteComponent) => remoteComponent.componentType === localOnlyComponent.componentType,
		);
		const selectedRemoteComponentName = await askForSelectLinkedComponent(
			'local',
			localOnlyComponent.componentType,
			localOnlyComponent.componentLocalId,
			localOnlyComponent.componentMetadata.label,
			unlinkedComponents,
		);

		if (typeof selectedRemoteComponentName === 'string') {
			// Link internal ID with already existing remote component.
			await addComponentIdMapping(
				localOnlyComponent.componentType,
				localOnlyComponent.componentLocalId,
				selectedRemoteComponentName,
				anyProjectPath,
				origin,
			);

			// Remove newly linked component from `remoteOnly`.
			remoteOnly = remoteOnly.filter(
				(component) =>
					component.componentType !== localOnlyComponent.componentType ||
					component.componentName !== selectedRemoteComponentName,
			);

			// Note: Now, the local component is fully linked with existing remote.
		} else {
			switch (selectedRemoteComponentName) {
				case anwersSpecialCases.CREATE_NEW_COMPONENT:
					{
						// Create new remote compoments (becuse it not exist)
						const newRemoteComponentName = await createRemoteAppComponent({
							appName: origin.appId,
							appVersion: origin.appVersion,
							componentType: localOnlyComponent.componentType,
							componentMetadata: localOnlyComponent.componentMetadata,
							componentName: localOnlyComponent.componentLocalId,
							origin,
						});
						// Add new remote component to idMapping (link with existing local component).
						await addComponentIdMapping(
							localOnlyComponent.componentType,
							localOnlyComponent.componentLocalId,
							newRemoteComponentName,
							anyProjectPath,
							origin,
						);

						// TODO Deploy all existing local codes and other configuration to remote newly created component (= sync remote component with local).
						// await deployComponent(...TODO...);
						break;
					}

					break;
				default:
					throw new Error(`Unknown special answer "${selectedRemoteComponentName?.description}"`);
			}
		}
	}

	// Ask user to link `remoteOnly` component(s) with unlinked local, or pull as new local compoment
	let remoteOnlyComponent: typeof remoteOnly[0];
	while (remoteOnlyComponent = remoteOnly.shift()!) {
		// TODO refactor to WHILE of
		// Remote component is not linked to local

		progresDialogReport('Asking user for additional information (see dialog on the top)');

		// Ask for "Select remote component, which should be linked with. Or new component will be created."
		const unlinkedComponents = localOnly
			.filter((localComponent) => localComponent.componentType === remoteOnlyComponent.componentType)
			.map((localComponent) => ({
				componentName: localComponent.componentLocalId,
				componentMetadata: localComponent.componentMetadata,
			}));
		const selectedLocalComponentId = await askForSelectLinkedComponent(
			'remote',
			remoteOnlyComponent.componentType,
			remoteOnlyComponent.componentName,
			remoteOnlyComponent.componentMetadata.label,
			unlinkedComponents,
		);

		if (typeof selectedLocalComponentId === 'string') {
			// Link internal ID with already existing remote component.
			await addComponentIdMapping(
				remoteOnlyComponent.componentType,
				selectedLocalComponentId,
				remoteOnlyComponent.componentName,
				anyProjectPath,
				origin,
			);

			// Remove newly linked component from `localOnly`.
			localOnly = localOnly.filter(
				(component) =>
					component.componentType !== remoteOnlyComponent.componentType ||
					component.componentLocalId !== selectedLocalComponentId,
			);

			// Note: Now, the remote component is fully linked with existing local.
		} else {
			switch (selectedLocalComponentId) {
				case anwersSpecialCases.CREATE_NEW_COMPONENT: {
					// TODO create new local component and link it with the existing remote one, pull the existing codes.
					await createLocalComponent(
						remoteOnlyComponent.componentType,
						remoteOnlyComponent.componentName,
						remoteOnlyComponent.componentMetadata.label,
						anyProjectPath,
					);
					throw new Error('Creating local component not implemented yet. Sorry. Under development.');
				}
				default:
					throw new Error(`Unknown special answer "${selectedLocalComponentId?.description}"`);
			}
		}
	}

	progresDialogReport('');
}

/**
 * TODO implement me!
 * @return Actual new local ID of new local component.
 */
async function createLocalComponent(
	componentType: AppComponentType,
	suggestedComponentLocalId: string,
	componentLabel: string | undefined,
	anyProjectPath: vscode.Uri,
): Promise<string> {
	switch (componentType) {
		// case 'connection':
		// 	await createLocalConnection();
		// 	break;
		// case 'module':
		// 	await createLocalModule();
		// 	break;
		default:
			// TODO Implement
			throw new Error(`Creation of ${componentType} is not implemented. Development in progress. Sorry.`);
	}
}
