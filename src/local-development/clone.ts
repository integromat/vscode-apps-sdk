import * as vscode from 'vscode';
import * as path from 'path';
import { getCurrentWorkspace } from '../services/workspace';
import { getCurrentEnvironment } from '../providers/configuration';
import {
	AppComponentMetadata,
	AppComponentMetadataWithCodeFiles,
	AppComponentTypesMetadata,
	ComponentCodeFilesMetadata,
	LocalAppOriginWithSecret,
	MakecomappJson,
} from './types/makecomapp.types';
import App from '../tree/App';
import { askForAppDirToClone } from './ask-local-dir';
import { APIKEY_DIRNAME, MAKECOMAPP_FILENAME } from './consts';
import {
	generalCodesDefinition,
	getAppComponentTypes,
} from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';
import { GeneralCodeName } from '../types/general-code-name.types';
import { downloadSource } from './code-deploy-download';
import { getAppComponentDetails, getAppComponents } from '../services/get-app-components';
import {
	ComponentsApiResponseItem,
	ComponentsApiResponseConnectionItem,
	ComponentsApiResponseModuleItem,
	ComponentsApiResponseWebhookItem,
	ModuleComponentDetailsApiResponseItem,
} from '../types/get-component-api-response.types';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';
import { getModuleDefFromId } from '../services/module-types-naming';
import { getAllComponentsSummaries } from './component-summaries';
import { generateDefaultCodeFilesPaths, generateDefaultLocalFilePath } from './local-file-paths';
import { catchError, withProgress } from '../error-handling';


export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.clone-to-workspace',
		catchError(
			'Download app to workspace',
			withProgress({ title: 'Downloading app to workspace...' }, cloneAppToWorkspace)
		)
	);
}

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
		components: await cloneAllFilesToLocal(await getAllComponentsSummaries(origin), origin, localAppRootdir),
		origins: [origin],
	};

	// Save .gitignore: exclude secrets dir, common data.
	const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
	const secretsDirRelativeToWorkspaceRoot = path.relative(workspaceRoot.fsPath, apikeyDir.fsPath);
	const gitignoreLines: string[] = ['*.common.json', secretsDirRelativeToWorkspaceRoot];
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

	// Process all app's direct codes
	for (const [codeName, codeDef] of Object.entries(generalCodesDefinition)) {
		const codeLocalRelativePath = generateDefaultLocalFilePath(
			codeDef,
			codeName,
			undefined,
			undefined,
			localAppRootdir,
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

	// Process all app's compoments
	for (const appComponentType of getAppComponentTypes()) {
		const appComponentSummaryList = await getAppComponents<ComponentsApiResponseItem>(appComponentType, origin);

		for (const appComponentSummary of appComponentSummaryList) {
			// Create section in makecomapp.json
			const componentMetadata: AppComponentMetadata = {
				label: appComponentSummary.label,
				description: appComponentSummary.description,
			};
			switch (appComponentType) {
				case 'connection':
					componentMetadata['connectionType'] = (
						appComponentSummary as ComponentsApiResponseConnectionItem
					).type;
					break;
				case 'webhook': {
					componentMetadata['webhookType'] = (appComponentSummary as ComponentsApiResponseWebhookItem).type;
					break;
				}
				case 'module':
					componentMetadata['moduleSubtype'] = getModuleDefFromId(
						(appComponentSummary as ComponentsApiResponseModuleItem).typeId,
					).type;
					if (componentMetadata['moduleSubtype'] === 'action') {
						componentMetadata['actionCrud'] = (appComponentSummary as ComponentsApiResponseModuleItem).crud;
					}
					break;
			}
			// Get and store connection, altConnection, webhook references
			if (['webhook', 'module', 'rpc'].includes(appComponentType)) {
				const componentDetails = await getAppComponentDetails(
					appComponentType,
					appComponentSummary.name,
					origin,
				);
				componentMetadata['connection'] = componentDetails.connection;
				componentMetadata['altConnection'] = componentDetails.altConnection;
				if (
					appComponentType === 'module' &&
					getModuleDefFromId((componentDetails as ModuleComponentDetailsApiResponseItem).typeId).type ===
						'instant_trigger'
				) {
					componentMetadata['webhook'] = componentDetails.webhook;
				}
			}

			makecomappJson.components[appComponentType][appComponentSummary.name] = {
				...componentMetadata,
				codeFiles: await cloneComponent(
					appComponentType,
					appComponentSummary.name,
					localAppRootdir,
					origin,
					componentMetadata,
				),
			};
		}
	}

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

async function cloneComponent(
	appComponentType: AppComponentType,
	appComponentName: string,
	localAppRootdir: vscode.Uri,
	origin: LocalAppOriginWithSecret,
	componentMetadata: AppComponentMetadata,
): Promise<ComponentCodeFilesMetadata> {
	// Generate Local file paths (Relative to app rootdir) + store metadata
	const componentCodeMetadata: ComponentCodeFilesMetadata = generateDefaultCodeFilesPaths(
		appComponentType,
		appComponentName,
		componentMetadata,
		localAppRootdir,
	);

	// Download codes from API to local files
	for (const [codeName, codeLocalRelativePath] of Object.entries(componentCodeMetadata.codeFiles)) {
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		await downloadSource({
			appComponentType,
			appComponentName,
			codeName,
			origin,
			destinationPath: codeLocalAbsolutePath,
		});
	}

	return componentCodeMetadata;
}

async function cloneAllFilesToLocal(
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
								return [
									componentName,
									<AppComponentMetadataWithCodeFiles>{
										...componentMetadata,
										codeFiles: await cloneComponent(
											componentType as AppComponentType,
											componentName,
											localAppRootdir,
											origin,
											componentMetadata,
										),
									},
								];
							}),
						),
					),
				];
			}),
		),
	);
	return <Record<AppComponentType, (typeof ret)[string]>>ret; // Force retype, because `fromEntries` loses a keys type.
}
