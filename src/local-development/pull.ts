import * as vscode from 'vscode';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	LocalAppOriginWithSecret,
} from './types/makecomapp.types';
import { getMakecomappJson, getMakecomappRootDir, upsertComponentInMakecomappjson } from './makecomappjson';
import { getAllComponentsSummaries } from './component-summaries';
import { getAppComponentTypes } from '../services/component-code-def';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { AppComponentType } from '../types/app-component-type.types';
import { downloadSource } from './code-deploy-download';
import { log } from '../output-channel';
import { catchError } from '../error-handling';
import { askForProjectOrigin } from './dialog-select-origin';
import { withProgressDialog } from '../utils/vscode-progress-dialog';
import { entries } from '../utils/typed-object';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.pull-new-components',
		catchError('Download app to workspace', async (makecomappJsonPath: vscode.Uri) => {
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
	const cloudAppComponents = await getAllComponentsSummaries(origin);
	const newComponens: Awaited<ReturnType<typeof pullNewComponents>> = [];

	for (const componentType of getAppComponentTypes()) {
		for (const [componentName, componentMetadata] of Object.entries(cloudAppComponents[componentType])) {
			if (!makecomappJson.components[componentType][componentName]) {
				// Local component not exists, so pull it
				pullComponent(componentType, componentName, componentMetadata, localAppRootdir, origin);
				newComponens.push({ componentType, componentName });
			}
		}
	}

	return newComponens;
}

/**
 * Pulls specified component from remote origin into local development.
 *
 * Creates all necessary local files and adds component to makecomapp.json manifest.
 */
async function pullComponent(
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
	await downloadCodeFiles(componentType, componentName, localAppRootdir, origin, componentMetadataWithCodefiles);
	// Write new component into makecomapp.json file
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
async function downloadCodeFiles(
	appComponentType: AppComponentType,
	appComponentName: string,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	componentMetadata: AppComponentMetadataWithCodeFiles,
): Promise<void> {
	log('debug', `Clone all codes of ${appComponentType} ${appComponentName}`);
	// Download codes from API to local files
	for (const [codeType, codeLocalRelativePath] of entries(componentMetadata.codeFiles)) {
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		await downloadSource({
			appComponentType,
			appComponentName,
			codeType,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}
}
