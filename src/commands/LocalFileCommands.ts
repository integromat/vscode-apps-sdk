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
import { ModuleComponentSummary, getAppComponents } from '../services/get-app-components';
import { existsSync } from 'fs';
import { getAppComponentCodeDefinition, getAppComponentDefinition } from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';

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

	const appModules = await getAppComponents<ModuleComponentSummary>('modules', appName, appVersion, environment);

	// makecomapp.json
	const makeappJsonPath = vscode.Uri.joinPath(srcDir, MAKECOMAPP_FILENAME);
	const makecomappJson: MakecomappJson = {
		components: {
			module: [],
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

	// Common
	vscode.workspace.fs.createDirectory(srcDir);
	// const baseLocalPath = vscode.Uri.joinPath(srcDir, 'base.imljson');
	// await downloadSource(appName, appVersion, 'app', '', 'api', environment, baseLocalPath.fsPath);
	const commonLocalPath = vscode.Uri.joinPath(srcDir, 'common.json');
	await downloadSource({appName, appVersion, appComponentType: 'app', appComponentName: '', codeName: 'common', environment, destinationPath: commonLocalPath.fsPath});

	const appComponentType: AppComponentType = 'module'; // TODO Loop over all component types

	for (const appModule of appModules) {
		// create module directory
		const modulesDir = vscode.Uri.joinPath(srcDir, appComponentType + 's');
		vscode.workspace.fs.createDirectory(modulesDir);
		// save codes into .imljson files
		const codeNames = Object.keys(getAppComponentDefinition(appComponentType));
		for(const codeName of codeNames) {
			const codeDef = getAppComponentCodeDefinition(appComponentType, codeName);
			const moduleLocalRelativeFilename = path.join(appComponentType + 's', appModule.name, codeName + '.' + codeDef.fileext);  // Relative to app rootdir
			const moduleLocalFilename = vscode.Uri.joinPath(srcDir, appModule.name, codeName + '.' + codeDef.fileext);
			await downloadSource({ appName, appVersion, appComponentType, appComponentName: appModule.name, codeName, environment, destinationPath: moduleLocalFilename.fsPath});
			makecomappJson.components[appComponentType].push({
				id: appModule.name,
				label: appModule.label,
				codes: {
					[codeName]: {
						codeName: codeName,
						file: moduleLocalRelativeFilename,
					}
				}
			});
		}
	}

	// Write makecomapp.json app metadata file
	await fs.writeFile(makeappJsonPath.fsPath, JSON.stringify(makecomappJson, null, 2));

	// Load app list
	// const appList: AppsListItem[] = (await Core.rpGet(`https://${environment.url}/v2/sdk/apps`, 'Token ' + environment.apikey, {
	// 	'cols[]': [
	// 		'name', 'label', 'description', 'version', 'beta', 'theme', 'public', 'approved', 'changes'
	// 	]
	// })).apps;
	// await fs.writeFile(join(modulesDir.fsPath, '.apps.json'), JSON.stringify(appList, null, 2));x`

	// Load module list

	vscode.window.showInformationMessage(`Downloaded to local workspace into "/src".`);
}


async function localFileUpload(file: vscode.Uri) {

	const makeappRootdir = getMakecomappRootDir(file);
	const makeappJson = await getMakecomappJson(file);
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath);  // Relative to makecomapp.json
	const moduleMetadata = makeappJson.components.module.find(module => module.file === fileRelativePath);  // TODO seach globally in all component types
	if (!moduleMetadata) {
		throw new Error(`Module for file ${file.fsPath} is not defined in ${MAKECOMAPP_FILENAME}.`);
	}

	const origin = makeappJson.origins[0];
	if (!origin) {
		throw new Error(`Origin is not defined in ${MAKECOMAPP_FILENAME}.`);
	}

	const environment = getCurrentEnvironment();

	log ('debug', `Deploying module ${moduleMetadata.id} from ${file.fsPath} to ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`);


	await uploadSource({ appName: origin.appId, appVersion: origin.appVersion, appComponentType: 'module', appComponentName: moduleMetadata.id, codeName: moduleMetadata.codeName, environment, sourcePath: file.fsPath});


	vscode.window.showInformationMessage(`Module ${moduleMetadata.id} deployed to Make app ${origin.appId}.`);
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

interface MakecomappJson {
	components: Record<AppComponentType, ModuleDef[]>;

	origins: {
		url: string,
		appId: string,
		appVersion: number,
	}[];
}

interface ModuleDef {
	id: string,
	label: string,
	codes: Record<string, {codeName: string /* TODO REMOVE codeName duplication from definition */, file: string}>;
}
