import * as vscode from 'vscode';
import * as path from 'path';
import { getCurrentWorkspace } from '../services/workspace';
import { getCurrentEnvironment } from '../providers/configuration';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	AppComponentTypesMetadata,
	LocalAppOriginWithSecret,
	MakecomappJson,
} from './types/makecomapp.types';
import App from '../tree/App';
import { askForAppDirToClone } from './ask-local-dir';
import { APIKEY_DIRNAME, MAKECOMAPP_FILENAME } from './consts';
import { generalCodesDefinition } from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';
import { GeneralCodeName } from '../types/general-code-name.types';
import { downloadSource } from './code-deploy-download';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';
import { getAllComponentsSummaries } from './component-summaries';
import { generateComponentDefaultCodeFilesPaths, generateDefaultLocalFilename } from './local-file-paths';
import { catchError, withProgress } from '../error-handling';
import { log } from '../output-channel';


export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.clone-to-workspace',
		catchError(
			'Download app to workspace',
			withProgress({ title: 'Downloading app to workspace...' }, cloneAppToWorkspace),
		),
	);
}

/**
 * Clones whole app from Make cloud to the local repository
 */
async function cloneAppToWorkspace(context: App): Promise<void> {
	const workspaceRoot = getCurrentWorkspace().uri;
	const apikeyDir = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME);
	const apikeyFileUri = vscode.Uri.joinPath(apikeyDir, 'apikey1');

	const localAppRootdir = await askForAppDirToClone();
	if (!localAppRootdir) {
		return;
	}

	const environment = getCurrentEnvironment();

	// makecomapp.json
	const makeappJsonPath = vscode.Uri.joinPath(localAppRootdir, MAKECOMAPP_FILENAME);
	// If manifest exists, cancel this task.
	if (existsSync(makeappJsonPath.fsPath)) {
		throw new Error(MAKECOMAPP_FILENAME + ' already exists in the workspace. Clone cancelled.');
	}

	const origin: LocalAppOriginWithSecret = {
		label: 'Origin',
		baseUrl: 'https://' + environment.url,
		appId: context.name,
		appVersion: context.version,
		apikeyFile: path.relative(path.dirname(makeappJsonPath.fsPath), apikeyFileUri.fsPath),
		apikey: environment.apikey,
	};

	const makecomappJson: MakecomappJson = {
		fileVersion: 1,
		generalCodeFiles: {} as any, // Missing mandatory values are filled in loop below.
		components: await cloneAllComponentsFilesToLocal(
			await getAllComponentsSummaries(origin),
			origin,
			localAppRootdir,
		),
		origins: [origin],
	};

	// Save .gitignore: exclude secrets dir, common data.
	const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
	const secretsDirRelativeToWorkspaceRoot = path.relative(workspaceRoot.fsPath, apikeyDir.fsPath);
	const gitignoreLines: string[] = ['common.json', '*.common.json', secretsDirRelativeToWorkspaceRoot];
	gitignoreLines.push(secretsDirRelativeToWorkspaceRoot);
	const gitignoreContent = new TextEncoder().encode(gitignoreLines.join('\n') + '\n');
	await vscode.workspace.fs.writeFile(gitignoreUri, gitignoreContent);
	// Create apikey file
	const apiKeyFileContent = new TextEncoder().encode(environment.apikey + '\n');
	await vscode.workspace.fs.writeFile(apikeyFileUri, apiKeyFileContent);

	// Create .vscode/settings.json with exclude secrets dir
	// const settingsJsonUri = vscode.Uri.joinPath(workspaceRoot, '.vscode', 'settings.json');
	// const settingsJsonContent = new TextEncoder().encode(JSON.stringify({
	// 	"files.exclude": {
	// 		[secretsDirRelativeToWorkspaceRoot]: true
	// 	}
	// }, null, 4));
	// await vscode.workspace.fs.writeFile(settingsJsonUri, settingsJsonContent);

	// #region Process all app's general codes
	for (const [codeName, codeDef] of Object.entries(generalCodesDefinition)) {
		const codeLocalRelativePath = await generateDefaultLocalFilename(
			// Note: target directories "general" and "modules" are defined in `codeDef`.
			codeDef,
			codeName,
			undefined,
			undefined,
			undefined,
		);
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		// Download code from API to local file
		await downloadSource({
			appComponentType: 'app', // The `app` type with name `` is the special
			appComponentName: '', //
			codeName,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
		// Add to makecomapp.json
		makecomappJson.generalCodeFiles[codeName as GeneralCodeName] = codeLocalRelativePath;
	}
	// #endregion Process all app's general codes

	// Write makecomapp.json app metadata file
	await vscode.workspace.fs.writeFile(
		makeappJsonPath,
		new TextEncoder().encode(JSON.stringify(makecomappJson, null, 4)),
	);
	// VSCode show readme.md and open explorer
	const readme = vscode.Uri.joinPath(localAppRootdir, 'readme.md');
	await vscode.commands.executeCommand('vscode.open', readme);
	await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
}

/**
 * Download all files of component from `componentMetadata.codeFiles` to local file system.
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
	for (const [codeName, codeLocalRelativePath] of Object.entries(componentMetadata.codeFiles)) {
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		await downloadSource({
			appComponentType,
			appComponentName,
			codeName,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}
}

/**
 * Clones app's all component's codes to local files.
 */
async function cloneAllComponentsFilesToLocal(
	allComponentSummaries: AppComponentTypesMetadata<AppComponentMetadata>,
	origin: LocalAppOriginWithSecret,
	localAppRootdir: vscode.Uri,
): Promise<AppComponentTypesMetadata<AppComponentMetadataWithCodeFiles>> {
	const ret = Object.fromEntries(
		await Promise.all(
			Object.entries(allComponentSummaries).map(async ([componentType, components]) => {
				return [
					<AppComponentType>componentType,
					Object.fromEntries(
						await Promise.all(
							Object.entries(components).map(async ([componentName, componentMetadata]) => {
								// Generate code files paths
								const componentMetadataWithCodefiles = <AppComponentMetadataWithCodeFiles>{
									...componentMetadata,
									codeFiles: await generateComponentDefaultCodeFilesPaths(
										componentType as AppComponentType,
										componentName,
										componentMetadata,
										localAppRootdir,
									),
								};
								// Download code files
								await downloadCodeFiles(
									componentType as AppComponentType,
									componentName,
									localAppRootdir,
									origin,
									componentMetadataWithCodefiles,
								);

								return [componentName, componentMetadataWithCodefiles];
							}),
						),
					),
				];
			}),
		),
	);
	return <Record<AppComponentType, (typeof ret)[string]>>ret; // Force retype, because `fromEntries` loses a keys type.
}
