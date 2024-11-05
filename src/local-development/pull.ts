import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	ComponentCodeFilesMetadata,
	LocalAppOriginWithSecret,
} from './types/makecomapp.types';
import {
	getMakecomappJson,
	getMakecomappRootDir,
	updateMakecomappJson,
	upsertComponentInMakecomappjson,
} from './makecomappjson';
import { convertComponentMetadataRemoteNamesToLocalIds, getRemoteComponent } from './remote-components-summary';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { pullComponentCode, pullComponentCodes } from './code-pull-deploy';
import { askForProjectOrigin } from './ask-origin';
import { alignComponentsMapping } from './align-components-mapping';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { MakecomappJsonFile } from './helpers/makecomapp-json-file-class';
import { generalCodesDefinition, getAppComponentTypes } from '../services/component-code-def';
import type { AppComponentType } from '../types/app-component-type.types';
import { catchError } from '../error-handling';
import { withProgressDialog } from '../utils/vscode-progress-dialog';
import { entries } from '../utils/typed-object';
import type { Checksum } from './types/checksum.types';
import { downloadOriginChecksums, getComponentChecksumArray } from './helpers/origin-checksum';

export function registerCommands(): void {
	/**
	 * Command for pulling all components. Adds new components and updates locally existing.
	 */
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.pull-all-components',
		catchError('Pull all components', async (makecomappJsonPath: vscode.Uri) => {
			const localAppRootdir = getMakecomappRootDir(makecomappJsonPath);
			const origin = await askForProjectOrigin(localAppRootdir);
			if (!origin) {
				return;
			}
			await withProgressDialog({ title: '' }, async (_progress, _cancellationToken) => {
				const originChecksums = await downloadOriginChecksums(origin);
				await pullAllComponents(localAppRootdir, origin, 'askUser', originChecksums);
			});
			vscode.window.showInformationMessage('All local app component files has been updated.');
		}),
	);
}

/**
 * Pulls all new component from remote origin into local development.
 *
 * Creates all necessary local files and adds component to makecomapp.json manifest.
 */
export async function pullAllComponents(
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	newRemoteComponentResolution: 'askUser' | 'cloneAsNew',
	originChecksums: Checksum,
): Promise<void> {

	// Pulling when there are undeployed changes. Override them and align the state with the origin.
	const makecomappJson = await getMakecomappJson(localAppRootdir);
	const componentIdMappingHelper = new ComponentIdMappingHelper(makecomappJson, origin);
	componentIdMappingHelper.filterMappingItems(item => !item?.localDeleted);
	await updateMakecomappJson(localAppRootdir, makecomappJson);

	// Compare all local components with remote. If something is not paired, link it or create new component or ignore component.
	await alignComponentsMapping(localAppRootdir, origin, originChecksums, 'ignore', newRemoteComponentResolution);
	// Load fresh `makecomapp.json` file (because `alignComponentMapping()` changed it)
	const makecomappJsonFile = await MakecomappJsonFile.fromLocalProject(localAppRootdir);

	// Pull app general codes
	for (const [codeType] of entries(generalCodesDefinition)) {
		const codeLocalRelativePath = makecomappJsonFile.content.generalCodeFiles[codeType];
		if (codeLocalRelativePath === null) {
			// Skip ignored component codes.
			continue;
		}
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		// Pull code from API to local file
		await pullComponentCode({
			appComponentType: 'app', // The `app` type with name `` is the special
			remoteComponentName: '',
			codeType,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}

	// Pull app components from remote
	// Note: All remote components already have local counterparts due to previously called `alignComponentsMapping()`.
	for (const componentType of getAppComponentTypes()) {
		const componentIdMapping = new ComponentIdMappingHelper(makecomappJsonFile.content, origin);
		const checksums = getComponentChecksumArray(originChecksums, componentType);
		const originNames = checksums.map((checksum) => {
			return checksum.name;
		});

		for (const remoteComponentName of originNames) {
			const componentLocalId = componentIdMapping.getExistingLocalId(componentType, remoteComponentName);
			if (componentLocalId === null) {
				continue;
				// Because the mapping defines this remote component as "ignore".
			}
			const existingComponentMetadata = makecomappJsonFile.content.components[componentType][componentLocalId];
			if (!existingComponentMetadata) {
				throw new Error(
					`Local ${componentType} "${componentLocalId}" expected, but not found in 'makecomapp.json'. Unexpected Error.`,
				);
				// Note: This should not happen, because previously called `alignComponentMapping()` must to also integrate all new/unknown remote component to local one.
			}

			// Prepate updated component metadata (merge with previous one)
			const remoteComponentMetadata = await getRemoteComponent(origin, componentType, remoteComponentName);
			const updatedComponentMedatada: AppComponentMetadataWithCodeFiles = {
				...existingComponentMetadata, // Use previous `codeFiles`
				// + Update all other properties by fresh one loaded from remote
				...convertComponentMetadataRemoteNamesToLocalIds(remoteComponentMetadata, componentIdMapping),
			};
			// Pull/update already existing component + save updated component metadata
			await pullComponent(
				componentType,
				remoteComponentName,
				componentLocalId,
				updatedComponentMedatada,
				localAppRootdir,
				origin,
				makecomappJsonFile.isCommonDataIncluded,
			);
		}
	}
}

/**
 * Pulls the component from remote origin and save it into local workspace.
 * It means creates/updates all necessary local files.
 * Also saves the `updatedComponentMetadata` as new metadata into `makecomapp.json` file.
 * Also adds/updates the component ID-mapping.
 *
 */
async function pullComponent(
	componentType: AppComponentType,
	remoteComponentName: string,
	componentLocalId: string,
	updatedComponentMetadata: AppComponentMetadata | AppComponentMetadataWithCodeFiles,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	includeCommonFiles: boolean,
) {
	// Generate code files paths if local component does not exist yet.
	//   (In this case the `updatedComponentMetadata` param value is being provided without `codeFiles`.)
	const existingLocalCodeFiles: ComponentCodeFilesMetadata | undefined = (
		updatedComponentMetadata as AppComponentMetadataWithCodeFiles
	).codeFiles;
	const componentMetadataWithCodefiles = {
		...updatedComponentMetadata,
		codeFiles:
			existingLocalCodeFiles ??
			(await generateComponentDefaultCodeFilesPaths(
				componentType,
				componentLocalId,
				updatedComponentMetadata,
				localAppRootdir,
				includeCommonFiles,
			)),
	} as AppComponentMetadataWithCodeFiles;

	// Download code files
	await pullComponentCodes(
		componentType,
		remoteComponentName,
		localAppRootdir,
		origin,
		componentMetadataWithCodefiles,
	);

	// Write new (or update existing) component into makecomapp.json file
	await upsertComponentInMakecomappjson(
		componentType,
		componentLocalId,
		remoteComponentName,
		componentMetadataWithCodefiles,
		localAppRootdir,
		origin,
	);

	return [remoteComponentName, componentMetadataWithCodefiles];
}
