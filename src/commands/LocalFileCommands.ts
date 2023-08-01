import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { catchError, showError } from '../error-handling';
import AppsProvider from '../providers/AppsProvider';
import { Environment } from '../types/environment.types';
import { log } from '../output-channel';
import App from '../tree/App';
import { getCurrentEnvironment } from '../providers/configuration';
import { downloadSource, uploadSource } from '../services/get-code';
import { ComponentSummary, getAppComponents } from '../services/get-app-components';
import { existsSync } from 'fs';
import { getAppComponentCodeDefinition, getAppComponentDefinition, getAppComponentTypes } from '../services/component-code-def';
import { AppComponentType as AppComponentTypeMetadata } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';

const MAKECOMAPP_FILENAME = 'makecomapp.json';

export class LocalFileCommands {

	static register(
		appsProvider: AppsProvider,
		_authorization: string,
		_environment: Environment
	): void {

		vscode.commands.registerCommand('apps-sdk.file.upload', catchError('File deploy to Make', localFileUpload));

		vscode.commands.registerCommand('apps-sdk.file.download', catchError('File download from Make', async function (context) {
			log('debug', 'Download context:' + JSON.stringify(context, null, 2));
			showError('Sorry, not implemented', 'apps-sdk.file.download');
		}));

		// Success UI message
		vscode.commands.registerCommand('apps-sdk.app.download-to-workspace', catchError('Download app to workspace', downloadAppToWorkspace));
	}
}


async function downloadAppToWorkspace(context: App): Promise<void> {
	const appName = context.name;
	const appVersion = context.version;
	const srcDir = getSdkAppRoot();

	// const configuration = getConfiguration();
	const environment = getCurrentEnvironment();

	// Component types are: functions, rpcs, modules, connections, webhooks, (apps)

	// makecomapp.json
	const makeappJsonPath = vscode.Uri.joinPath(srcDir, MAKECOMAPP_FILENAME);
	const makecomappJson: MakecomappJson = {
		components: {
			module: {},
		},
		origins: [
			{
				url: environment.url,   /// TODO it is not actually the url, it is without https://
				appId: context.name,
				appVersion: context.version,
			}
		]
	};

	if (existsSync(makeappJsonPath.fsPath)) {
		throw new Error(MAKECOMAPP_FILENAME + ' already exists in the workspace. Download cancelled.');
	}

	// Create src directory
	await vscode.workspace.fs.createDirectory(srcDir);

	// Common
	// const commonLocalPath = vscode.Uri.joinPath(srcDir, 'common.json');
	// await downloadSource({appName, appVersion, appComponentType: 'app', appComponentName: '', codeName: 'common', environment, destinationPath: commonLocalPath.fsPath});


	for (const appComponentType of getAppComponentTypes()) {
		const appComponentSummaryList = await getAppComponents<ComponentSummary>(appComponentType, appName, appVersion, environment);

		for (const appComponentSummary of appComponentSummaryList) {

			// create module directory
			const modulesDir = vscode.Uri.joinPath(srcDir, appComponentType + 's');
			vscode.workspace.fs.createDirectory(modulesDir);
			// Create section in makecomapp.json
			makecomappJson.components[appComponentType][appComponentSummary.name] = {
				// label: appComponentSummary.label,   // todo enable and change type above to ModuleComponentSummary, ... based on componentType
				codes: {},
			};
			// Process all codes
			const codeNames = Object.keys(getAppComponentDefinition(appComponentType));
			for(const codeName of codeNames) {
				const codeDef = getAppComponentCodeDefinition(appComponentType, codeName);
				// Local file path generator
				const filebasename = camelToKebab(appComponentSummary.name) + '.' + (codeDef.filename ? codeDef.filename : codeName);
				const codeLocalRelativePath = path.join(appComponentType + 's', camelToKebab(appComponentSummary.name), filebasename + '.' + codeDef.fileext);  // Relative to app rootdir
				const codeLocalAbsolutePath = vscode.Uri.joinPath(srcDir, codeLocalRelativePath);
				// Download code from API to local file
				await downloadSource({ appName, appVersion, appComponentType, appComponentName: appComponentSummary.name, codeName, environment, destinationPath: codeLocalAbsolutePath.fsPath});
				// Add to makecomapp.json
				makecomappJson.components[appComponentType][appComponentSummary.name].codes[codeName] = {
					file: codeLocalRelativePath,
				};
			}
		}
	}

	// Write makecomapp.json app metadata file
	await fs.writeFile(makeappJsonPath.fsPath, JSON.stringify(makecomappJson, null, 4));

	vscode.window.showInformationMessage(`Downloaded to local workspace into "/src".`);
}


async function localFileUpload(file: vscode.Uri) {

	const makeappJson = await getMakecomappJson(file);
	const origin = makeappJson.origins[0];
	if (!origin) {
		throw new Error(`Origin is not defined in ${MAKECOMAPP_FILENAME}.`);
	}

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath);  // Relative to makecomapp.json
	const componentDetails = findCodeByFilename(fileRelativePath, makeappJson.components);

	log ('debug', `Deploying ${componentDetails.componentType} ${componentDetails.componentName} from ${file.fsPath} to ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`);

	const environment = getCurrentEnvironment();

	await uploadSource({ appName: origin.appId, appVersion: origin.appVersion, appComponentType: componentDetails.componentType, appComponentName: componentDetails.componentName, codeName: componentDetails.codeName, environment, sourcePath: file.fsPath});

	vscode.window.showInformationMessage(`${componentDetails.componentType} ${componentDetails.componentName} deployed to Make app ${origin.appId}.`);
}


function getCurrentWorkspace(): vscode.WorkspaceFolder {
	if (!vscode.workspace.workspaceFolders) {
		throw new Error('No workspace opened');
	}
	if (vscode.workspace.workspaceFolders.length > 1) {
		throw new Error('More than one workspace opened. Cannot decide, where to download app.');
	}

	return vscode.workspace.workspaceFolders[0];
}


function getSdkAppRoot(): vscode.Uri {
	const workspace = getCurrentWorkspace();
	return vscode.Uri.joinPath(workspace.uri, 'src');
}

/**
 * FinSd the nearest parent dir, where makecomapp.json is located.
 * File must be located in the workspace.
 * @return Directory, where makecomapp.json is located.
 */
function getMakecomappRootDir(startingPath: vscode.Uri): vscode.Uri {
	const workspace = getCurrentWorkspace();
	const startDirRelative = path.relative(workspace.uri.fsPath, startingPath.fsPath);
	if (startDirRelative.startsWith('..') || startingPath.fsPath === path.parse(startingPath.fsPath).root) {
		throw new Error(`Appropriate ${MAKECOMAPP_FILENAME} file not found in the workspace.`);
	}

	if (existsSync(path.join(startingPath.fsPath, MAKECOMAPP_FILENAME))) {
		return startingPath;
	} else {
		return getMakecomappRootDir(vscode.Uri.joinPath(startingPath, '..'));
	}
}

/**
 * Gets makecomapp.json content from the nearest parent dir, where makecomapp.json is located.
 */
async function getMakecomappJson(startingPath: vscode.Uri): Promise<MakecomappJson> {
	const makecomappRootdir = getMakecomappRootDir(startingPath);
	const makecomappJsonPath = vscode.Uri.joinPath(makecomappRootdir, MAKECOMAPP_FILENAME);
	const makecomappJson = JSON.parse((await fs.readFile(makecomappJsonPath.fsPath)).toString()) as MakecomappJson;
	return makecomappJson;
}


function findCodeByFilename(fileRelativePath: string, appComponentTypes: AppComponentTypesMetadata): {
	componentType: AppComponentTypeMetadata,
	componentName: string,
	codeName: string,
} {
	for (const componentType in appComponentTypes) {
		for (const componentName in appComponentTypes[componentType as AppComponentTypeMetadata]) {
			const codesMetadata: CodesMetadata = appComponentTypes[componentType as AppComponentTypeMetadata][componentName].codes || {};
			for (const codeName in codesMetadata) {
				const codeMetadata = codesMetadata[codeName];
				if (codeMetadata.file === fileRelativePath) {
					return {
						componentType: componentType as AppComponentTypeMetadata,
						componentName,
						codeName,
					};
				}
			}
		}
	}
	throw new Error(`Code file ${fileRelativePath} is not defined in ${MAKECOMAPP_FILENAME}.`);
}

interface MakecomappJson {
	components: AppComponentTypesMetadata;

	origins: {
		url: string,
		appId: string,
		appVersion: number,
	}[];
}

type AppComponentTypesMetadata = Record<AppComponentTypeMetadata, AppComponentsMetadata>;

/** Component ID => def */
type AppComponentsMetadata = Record<string, AppComponentMetadata>

interface AppComponentMetadata {
	label?: string,
	codes: CodesMetadata;
}

type CodesMetadata = Record<string, CodeMetadata>;
interface CodeMetadata {
	file: string,
}
