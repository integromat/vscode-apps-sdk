import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	LocalAppOriginWithSecret,
} from './types/makecomapp.types';
import { getMakecomappJson, getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';
import { getAllRemoteComponentsSummaries } from './component-summaries';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { pullComponentCode } from './code-pull-deploy';
import { askForProjectOrigin } from './dialog-select-origin';
import { getAppComponentTypes } from '../services/component-code-def';
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
				return pullNewComponents(localAppRootdir, origin);
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
}

/**
 * Pulls all new component from remote origin into local development.
 *
 * Creates all necessary local files and adds component to makecomapp.json manifest.
 */
export async function pullNewComponents(
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
): Promise<{ componentType: AppComponentType; componentName: string }[]> {
	const makecomappJson = await getMakecomappJson(localAppRootdir);
	const cloudAppComponents = await getAllRemoteComponentsSummaries(origin);
	const newComponents: Awaited<ReturnType<typeof pullNewComponents>> = [];

	for (const componentType of getAppComponentTypes()) {
		for (const [componentName, componentMetadata] of Object.entries(cloudAppComponents[componentType])) {
			if (!makecomappJson.components[componentType][componentName]) {
				// Local component not exists, so pull it
				pullNewComponent(componentType, componentName, componentMetadata, localAppRootdir, origin);
				newComponents.push({ componentType, componentName });
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
async function pullNewComponent(
	componentType: AppComponentType,
	componentName: string,
	componentMetadata: AppComponentMetadata,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
) {
	// Generate code files paths
	const componentMetadataWithCodefiles = <AppComponentMetadataWithCodeFiles>{
		...componentMetadata,
		codeFiles: await generateComponentDefaultCodeFilesPaths(
			componentType,
			componentName,
			componentMetadata,
			localAppRootdir,
			origin.appId,
		),
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
