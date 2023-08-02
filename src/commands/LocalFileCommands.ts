import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { catchError, showError, withProgress } from '../error-handling';
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

		vscode.commands.registerCommand('apps-sdk.file.upload', catchError(
			'File deploy to Make',
			withProgress(
				{ title: 'Deploying to Make...' },
				localFileUpload
			)
		));

		vscode.commands.registerCommand('apps-sdk.file.download', catchError(
			'File download from Make',
			withProgress(
				{ title: 'Updating local file from Make...' },
				localFileDownload
			)
		));

		vscode.commands.registerCommand('apps-sdk.app.download-to-workspace', catchError(
			'Download app to workspace',
			withProgress(
				{ title: 'Downloading app to workspace...' },
				downloadAppToWorkspace
			)
		));
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


/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
async function localFileUpload(file: vscode.Uri) {

	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath);  // Relative to makecomapp.json
	const componentDetails = findCodeByFilename(fileRelativePath, makeappJson.components);

	const origin = await askForOrigin(makeappJson.origins);
	if (!origin) {
		return;
	}

	log ('debug', `Deploying ${componentDetails.componentType} ${componentDetails.componentName} from ${file.fsPath} to ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`);


	/** @deprecated */
	const environment = getCurrentEnvironment();

	await uploadSource({ appName: origin.appId, appVersion: origin.appVersion, appComponentType: componentDetails.componentType, appComponentName: componentDetails.componentName, codeName: componentDetails.codeName, environment, sourcePath: file.fsPath});

	vscode.window.showInformationMessage(`${componentDetails.componentType} ${componentDetails.componentName} deployed to Make app ${origin.appId}.`);
}


/**
 * Rewrites the local file defined in makecomapp.json by version from the Make cloud.
 */
async function localFileDownload(file: vscode.Uri) {

	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath);  // Relative to makecomapp.json
	const componentDetails = findCodeByFilename(fileRelativePath, makeappJson.components);

	const origin = await askForOrigin(makeappJson.origins);
	if (!origin) {
		return;
	}

	log ('debug', `Downloading/rewriting ${componentDetails.componentType} ${componentDetails.componentName} in ${file.fsPath} from ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`);

	/** @deprecated */
	const environment = getCurrentEnvironment();
	// Download the cloud file version into temp file
	const newTmpFile = vscode.Uri.file(tempFilename(file.fsPath));
	await downloadSource({ appName: origin.appId, appVersion: origin.appVersion, appComponentType: componentDetails.componentType, appComponentName: componentDetails.componentName, codeName: componentDetails.codeName, environment, destinationPath: newTmpFile.fsPath});
	// Keep user to approve changes
	await vscode.commands.executeCommand("vscode.diff", newTmpFile, file);
	// Delete temp file
	await vscode.workspace.fs.delete(newTmpFile);

	// vscode.window.showInformationMessage(`${componentDetails.componentType} ${componentDetails.componentName} rewritten by version in Make.`);
}

/**
 * From absolute file path it generates the same one, but with ".tmp" postfix before file extension.
 */
function tempFilename(filename: string): string {
	const parsed = path.parse(filename);
	return path.join(parsed.dir, parsed.name + '.tmp' + parsed.ext);
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

/**
 *
 * @param origins
 * @param purposeLabel If defined, the text is integrated into dialog message as "Choose ... for ${purposeLabel}:"
 * @returns Return undefined, when there are multiple origins, but user cancels the selection dialog.
 */
async function askForOrigin(origins: LocalAppOrigin[], purposeLabel?: string): Promise<LocalAppOrigin|undefined> {
	if (!origins?.length) {
		throw new Error('Missing "origins" in makecomapp.json.');
	}

	if (origins.length === 1) {
		return origins[0];
	}

	const selectedOrigin = await vscode.window.showQuickPick(
		origins.map((origin, index) => {
			const label = origin.label || (origin.appId + ' ' + origin.appVersion);
			return <{ origin: LocalAppOrigin } & vscode.QuickPickItem>{
				label,
				description: 'server: ' + origin.url,
				picked: (index === 0),
				origin: origin
			};
		}), {
			ignoreFocusOut: true,
			title: "Select the app origin"
				+ (purposeLabel ? `for ${purposeLabel}` : '')
				+ ":"
		}
	);
	return selectedOrigin?.origin;
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
	origins: LocalAppOrigin[];
}

interface LocalAppOrigin {
	/** User friendly title */
	label?: string;
	url: string;
	appId: string;
	appVersion: number;
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
