import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	LocalAppOriginWithSecret,
	MakecomappJson,
} from './types/makecomapp.types';
import { addComponentIdMapping } from './makecomappjson';
import { anwersSpecialCases, askForSelectMappedComponent } from './dialog-select-linked-component';
import { createRemoteAppComponent } from './create-remote-component';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { deployComponentCode, pullComponentCodes } from './code-pull-deploy';
import { createLocalEmptyComponent } from './create-local-empty-component';
import { RemoteComponentsSummary } from './types/remote-components-summary.types';
import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';
import { progresDialogReport } from '../utils/vscode-progress-dialog';

/**
 * Compares list of components from two sources. If some component is missing on one side,
 * it is created and paired in mapping, or original component is marked for ignorring.
 *
 * IMPORTANT: Changes the `makecomapp.json` file.
 */
export async function alignComponentsMapping(
	makecomappJson: MakecomappJson,
	makecomappRootDir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	remoteComponentsSummary: RemoteComponentsSummary,
	newLocalComponentResolution: 'askUser' | 'ignore',
	newRemoteComponentResolution: 'askUser' | 'cloneAsNew' | 'ignore',
): Promise<void> {
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
		componentMetadata: AppComponentMetadata;
	}[] = [];

	// Fill `remoteOnly`
	for (const [componentType, components] of entries(remoteComponentsSummary)) {
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
		const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);

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

	// Resolve 'localOnly'
	if (newLocalComponentResolution !== 'ignore') {
		// Ask user to link `localOnly` component(s) with unlinked remote, or create new remote component
		let localOnlyComponent: (typeof localOnly)[0];
		while ((localOnlyComponent = localOnly.shift()!)) {
			// Local component is not linked to remote

			progresDialogReport('Asking user for additional information (see dialog on the top)');

			// Ask for "Select remote component, which should be linked with. Or new component will be created."
			const unlinkedComponents = remoteOnly.filter(
				(remoteComponent) => remoteComponent.componentType === localOnlyComponent.componentType,
			);
			let selectedRemoteComponentName: string | symbol | null;
			switch (newLocalComponentResolution) {
				case 'askUser':
					selectedRemoteComponentName = await askForSelectMappedComponent(
						'local',
						localOnlyComponent.componentType,
						localOnlyComponent.componentLocalId,
						localOnlyComponent.componentMetadata.label,
						unlinkedComponents,
					);
					break;
				// Note: `case 'ignore':` skipped by parent `if` condition
				default:
					throw new Error(
						`Unknown function parameter newLocalComponentResolution = ${newLocalComponentResolution}`,
					);
			}

			if (typeof selectedRemoteComponentName === 'string' || selectedRemoteComponentName === null) {
				// Link internal ID with already existing remote component.
				await addComponentIdMapping(
					localOnlyComponent.componentType,
					localOnlyComponent.componentLocalId,
					selectedRemoteComponentName,
					makecomappRootDir,
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
					case anwersSpecialCases.CREATE_NEW_COMPONENT: {
						// Create new remote compoments (becuse it not exist)
						const newRemoteComponentName = await createRemoteAppComponent({
							appName: origin.appId,
							appVersion: origin.appVersion,
							componentType: localOnlyComponent.componentType,
							componentMetadata: localOnlyComponent.componentMetadata,
							componentName: localOnlyComponent.componentLocalId,
							origin,
						});

						// Push local codes to new remote component
						for (const [codeType, codeLocalRelativePath] of entries(
							localOnlyComponent.componentMetadata.codeFiles,
						)) {
							await deployComponentCode({
								appComponentType: localOnlyComponent.componentType,
								codeType,
								remoteComponentName: newRemoteComponentName,
								origin,
								sourcePath: vscode.Uri.joinPath(makecomappRootDir, codeLocalRelativePath),
							});

							// TODO Implement: Deploy also other configuration (connection, altConnection, webhook).
						}

						// Add new remote component to idMapping (link with existing local component).
						await addComponentIdMapping(
							localOnlyComponent.componentType,
							localOnlyComponent.componentLocalId,
							newRemoteComponentName,
							makecomappRootDir,
							origin,
						);
						break;
					}
					default:
						throw new Error(`Unknown special answer "${selectedRemoteComponentName?.description}"`);
				}
			}
		}
	}

	// Resolve 'remoteOnly'
	if (newRemoteComponentResolution !== 'ignore') {
		// Ask user to link `remoteOnly` component(s) with unlinked local, or pull as new local compoment
		let remoteOnlyComponent: (typeof remoteOnly)[0];
		while ((remoteOnlyComponent = remoteOnly.shift()!)) {
			// Remote component is not linked to local

			progresDialogReport('Asking user for additional information (see dialog on the top)');

			// Ask for "Select remote component, which should be linked with. Or new component will be created."
			const unlinkedComponents = localOnly
				.filter((localComponent) => localComponent.componentType === remoteOnlyComponent.componentType)
				.map((localComponent) => ({
					componentName: localComponent.componentLocalId,
					componentMetadata: localComponent.componentMetadata,
				}));

			let selectedLocalComponentId: string | symbol | null;
			switch (newRemoteComponentResolution) {
				case 'askUser':
					selectedLocalComponentId = await askForSelectMappedComponent(
						'remote',
						remoteOnlyComponent.componentType,
						remoteOnlyComponent.componentName,
						remoteOnlyComponent.componentMetadata.label,
						unlinkedComponents,
					);
					break;
				case 'cloneAsNew':
					selectedLocalComponentId = anwersSpecialCases.CREATE_NEW_COMPONENT;
					break;
				// Note: `case 'ignore':` skipped by parent `if` condition
				default:
					throw new Error(
						`Unknown function parameter newRemoteComponentResolution = ${newRemoteComponentResolution}`,
					);
			}

			if (typeof selectedLocalComponentId === 'string' || selectedLocalComponentId === null) {
				// Link internal ID with already existing remote component.
				await addComponentIdMapping(
					remoteOnlyComponent.componentType,
					selectedLocalComponentId,
					remoteOnlyComponent.componentName,
					makecomappRootDir,
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
						// Create new empty local component
						const newComponent = await createLocalEmptyComponent(
							remoteOnlyComponent.componentType,
							remoteOnlyComponent.componentName,
							remoteOnlyComponent.componentMetadata,
							makecomappRootDir,
						);
						// Pull existing codes to new local component
						await pullComponentCodes(
							remoteOnlyComponent.componentType,
							remoteOnlyComponent.componentName,
							makecomappRootDir,
							origin,
							newComponent.componentMetadata,
						);
						// Link it with existing remote component
						await addComponentIdMapping(
							remoteOnlyComponent.componentType,
							newComponent.componentLocalId,
							remoteOnlyComponent.componentName,
							makecomappRootDir,
							origin,
						);
						break;
					}
					default:
						throw new Error(`Special answer "${selectedLocalComponentId?.description}" is unknown`);
				}
			}
		}
	}

	progresDialogReport('');
}
