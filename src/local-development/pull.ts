import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	ComponentCodeFilesMetadata,
	LocalAppOriginWithSecret,
} from './types/makecomapp.types';
import { getMakecomappJson, getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';
import { getAllRemoteComponentsSummaries } from './component-summaries';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { pullComponentCode } from './code-pull-deploy';
import { askForProjectOrigin } from './dialog-select-origin';
import { generalCodesDefinition, getAppComponentTypes } from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';
import { log } from '../output-channel';
import { catchError } from '../error-handling';
import { withProgressDialog } from '../utils/vscode-progress-dialog';
import { entries } from '../utils/typed-object';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.pull-new-components',
		catchError('Pull new components', async (makecomappJsonPath: vscode.Uri) => {
			const localAppRootdir = getMakecomappRootDir(makecomappJsonPath);
			const origin = await askForProjectOrigin(localAppRootdir);
			if (!origin) {
				return;
			}
			const newComponents = await withProgressDialog({ title: '' }, async (_progress, _cancellationToken) => {
				return pullComponents(localAppRootdir, origin, 'new-only');
			});
			if (newComponents.length > 0) {
				vscode.window.showInformationMessage(
					`New ${newComponents.length} local components pulled:` +
						newComponents
							.map((newComponent) => `${newComponent.componentType} ${newComponent.componentName}`)
							.join(', '),
				);
			} else {
				vscode.window.showInformationMessage('No new remote components.');
			}
		}),
	);

	/**
	 * Command for pulling all components. Adds new and updates existing.
	 */
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.pull-all-components',
		catchError('Pull all components', async (makecomappJsonPath: vscode.Uri) => {
			const localAppRootdir = getMakecomappRootDir(makecomappJsonPath);
			const origin = await askForProjectOrigin(localAppRootdir);
			if (!origin) {
				return;
			}
			const newComponents = await withProgressDialog({ title: '' }, async (_progress, _cancellationToken) => {
				return pullComponents(localAppRootdir, origin, 'all');
			});
			if (newComponents.length > 0) {
				vscode.window.showInformationMessage(
					`All local files updated. New ${newComponents.length} local components pulled:` +
						newComponents
							.map((newComponent) => `${newComponent.componentType} ${newComponent.componentName}`)
							.join(', '),
				);
			} else {
				vscode.window.showInformationMessage('All local files updated.');
			}
		}),
	);
}

/**
 * Pulls all new component from remote origin into local development.
 *
 * Creates all necessary local files and adds component to makecomapp.json manifest.
 */
export async function pullComponents(
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	pullMode: 'new-only' | 'all',
): Promise<{ componentType: AppComponentType; componentName: string }[]> {
	const makecomappJson = await getMakecomappJson(localAppRootdir);
	const remoteAppComponents = await getAllRemoteComponentsSummaries(origin);
	const newComponents: Awaited<ReturnType<typeof pullComponents>> = [];

	// Pull app general codes (in `all` pull mode only)
	if (pullMode === 'all') {
		for (const [codeType] of entries(generalCodesDefinition)) {
			const codeLocalRelativePath = makecomappJson.generalCodeFiles[codeType];
			const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
			// Pull code from API to local file
			await pullComponentCode({
				appComponentType: 'app', // The `app` type with name `` is the special
				appComponentName: '',
				codeType,
				origin,
				destinationPath: codeLocalAbsolutePath,
			});
		}
	}

	// Pull app components
	for (const componentType of getAppComponentTypes()) {
		for (const [componentName, remoteComponentMetadata] of Object.entries(remoteAppComponents[componentType])) {
			const existingComponentMetadata = makecomappJson.components[componentType][componentName];
			if (!existingComponentMetadata) {
				pullComponent(componentType, componentName, remoteComponentMetadata, localAppRootdir, origin);
				newComponents.push({ componentType, componentName });
			} else if (pullMode === 'all') {
				pullComponent(componentType, componentName, existingComponentMetadata, localAppRootdir, origin);
			}
		}
	}

	return newComponents;
}

/**
 * Pulls specified component from remote origin into local development.
 *
 * Creates all necessary local files and adds component to makecomapp.json manifest.
 */
async function pullComponent(
	componentType: AppComponentType,
	componentName: string,
	componentMetadata: AppComponentMetadata | AppComponentMetadataWithCodeFiles,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
) {
	// Generate code files paths if local component does not exist yet
	const existingLocalCodeFiles: ComponentCodeFilesMetadata | undefined = (
		componentMetadata as AppComponentMetadataWithCodeFiles
	).codeFiles;
	const componentMetadataWithCodefiles = <AppComponentMetadataWithCodeFiles>{
		...componentMetadata,
		codeFiles:
			existingLocalCodeFiles ??
			(await generateComponentDefaultCodeFilesPaths(
				componentType,
				componentName,
				componentMetadata,
				localAppRootdir,
				origin.appId,
			)),
	};

	// Download code files
	await pullComponentCodes(componentType, componentName, localAppRootdir, origin, componentMetadataWithCodefiles);

	// Write new (or update existing) component into makecomapp.json file
	await upsertComponentInMakecomappjson(
		componentType,
		componentName,
		componentMetadataWithCodefiles,
		localAppRootdir,
	);

	return [componentName, componentMetadataWithCodefiles];
}

/**
 * Downloads all files of component specified in `componentMetadata.codeFiles`
 * from remote origin to local file system.
 */
async function pullComponentCodes(
	appComponentType: AppComponentType,
	appComponentName: string,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	componentMetadata: AppComponentMetadataWithCodeFiles,
): Promise<void> {
	log('debug', `Pull ${appComponentType} ${appComponentName}: all codes`);
	// Download codes from API to local files
	for (const [codeType, codeLocalRelativePath] of entries(componentMetadata.codeFiles)) {
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		await pullComponentCode({
			appComponentType,
			appComponentName,
			codeType,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}
}
