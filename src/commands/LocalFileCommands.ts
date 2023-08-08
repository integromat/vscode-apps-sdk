import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TextEncoder } from 'util';
import { catchError, withProgress } from '../error-handling';
import { log } from '../output-channel';
import App from '../tree/App';
import { getCurrentEnvironment } from '../providers/configuration';
import { downloadSource, uploadSource } from '../services/get-code';
import { ComponentSummary, getAppComponents } from '../services/get-app-components';
import { existsSync } from 'fs';
import {
	appCodesDefinition,
	getAppComponentCodeDefinition,
	getAppComponentDefinition,
	getAppComponentTypes,
} from '../services/component-code-def';
import { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { AppCodeName } from '../types/app-code-name.types';

const MAKECOMAPP_FILENAME = 'makecomapp.json';
const APIKEY_DIRNAME = '.secrets';

export class LocalFileCommands {
	static register(): void {
		vscode.commands.registerCommand('apps-sdk.file.upload', catchError('Deploy to Make', localFileUpload));

		vscode.commands.registerCommand(
			'apps-sdk.file.download',
			catchError(
				'File download from Make',
				withProgress({ title: 'Updating local file from Make...' }, localFileDownload)
			)
		);

		vscode.commands.registerCommand(
			'apps-sdk.app.clone-to-workspace',
			catchError(
				'Download app to workspace',
				withProgress({ title: 'Downloading app to workspace...' }, cloneAppToWorkspace)
			)
		);
	}
}

async function cloneAppToWorkspace(context: App): Promise<void> {
	const appName = context.name;
	const appVersion = context.version;
	const workspaceRoot = getCurrentWorkspace().uri;
	const apikeyDir = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME);
	const apikeyFileUri = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME, 'apikey1');

	const localAppRootdir = await askForAppDirToClone();
	if (!localAppRootdir) {
		return;
	}

	// const configuration = getConfiguration();
	const environment = getCurrentEnvironment();

	// makecomapp.json
	const makeappJsonPath = vscode.Uri.joinPath(localAppRootdir, MAKECOMAPP_FILENAME);
	const makecomappJson: MakecomappJson = {
		codes: {} as any, // Missing mandatory values are filled in loop below.
		components: {
			connection: {},
			webhook: {},
			module: {},
			rpc: {},
			function: {},
		},
		origins: [
			{
				label: 'Origin',
				url: environment.url, // TODO it is not actually the url, it is without https://
				appId: context.name,
				appVersion: context.version,
				apikeyFile: path.relative(makeappJsonPath.fsPath, apikeyFileUri.fsPath),
			},
		],
	};

	if (existsSync(makeappJsonPath.fsPath)) {
		throw new Error(MAKECOMAPP_FILENAME + ' already exists in the workspace. Clone cancelled.');
	}

	// Save .gitignore: exclude secrets dir
	const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
	const secretsDirRelativeToWorkspaceRoot = path.relative(workspaceRoot.fsPath, apikeyDir.fsPath);
	const gitignoreContent = new TextEncoder().encode(secretsDirRelativeToWorkspaceRoot + '\n');
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
	for (const [codeName, codeDef] of Object.entries(appCodesDefinition)) {
		const filebasename = codeDef.filename ? codeDef.filename : codeName;
		const codeLocalRelativePath = filebasename + '.' + codeDef.fileext; // Relative to app rootdir
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		// Download code from API to local file
		await downloadSource({
			appName,
			appVersion,
			appComponentType: 'app', // The `app` type with name `` is the special
			appComponentName: '', //
			codeName,
			environment,
			destinationPath: codeLocalAbsolutePath,
		});
		// Add to makecomapp.json
		makecomappJson.codes[codeName as AppCodeName] = {
			file: codeLocalRelativePath,
		};
	}

	// Process all app's compoments
	for (const appComponentType of getAppComponentTypes()) {
		const appComponentSummaryList = await getAppComponents<ComponentSummary>(
			appComponentType,
			appName,
			appVersion,
			environment
		);

		for (const appComponentSummary of appComponentSummaryList) {
			// Create section in makecomapp.json
			makecomappJson.components[appComponentType][appComponentSummary.name] = {
				// label: appComponentSummary.label,   // todo enable and change type above to ModuleComponentSummary, ... based on componentType
				codes: {},
			};
			// Process all codes
			const codeNames = Object.keys(getAppComponentDefinition(appComponentType));
			for (const codeName of codeNames) {
				const codeDef = getAppComponentCodeDefinition(appComponentType, codeName);
				// Local file path generator
				const filebasename =
					camelToKebab(appComponentSummary.name) + '.' + (codeDef.filename ? codeDef.filename : codeName);
				const codeLocalRelativePath = path.join(
					appComponentType + 's',
					camelToKebab(appComponentSummary.name),
					filebasename + '.' + codeDef.fileext
				); // Relative to app rootdir
				const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
				// Download code from API to local file
				await downloadSource({
					appName,
					appVersion,
					appComponentType,
					appComponentName: appComponentSummary.name,
					codeName,
					environment,
					destinationPath: codeLocalAbsolutePath,
				});
				// Add to makecomapp.json
				makecomappJson.components[appComponentType][appComponentSummary.name].codes[codeName] = {
					file: codeLocalRelativePath,
				};
			}
		}
	}

	// Write makecomapp.json app metadata file
	await fs.writeFile(makeappJsonPath.fsPath, JSON.stringify(makecomappJson, null, 4));
	// VSCode show makecomapp.json and open explorer
	await vscode.commands.executeCommand('vscode.open', makeappJsonPath);
	await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
}

/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
async function localFileUpload(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);
	const stat = await vscode.workspace.fs.stat(file);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json
	const components = findCodesByPath(fileRelativePath, makeappJson, makeappRootdir);

	if (components.length === 0) {
		throw new Error('Sorry, no associated component code with this file/path found.');
	}

	const origin = await askForOrigin(makeappJson.origins);
	if (!origin) {
		return;
	}

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			cancellable: true,
			title: `Deploying ${components.length} codes to Make`,
		},
		async (progress, cancellationToken) => {
			let canceled = false;
			cancellationToken.onCancellationRequested(() => {
				canceled = true;
			});

			for (let i = 0; i < components.length; i++) {
				const component = components[i];
				// Update the progress bar
				progress.report({
					increment: 100 / components.length,
					message: `${component.componentType} ${component.componentName} ${component.codeName}`,
				});
				// Log to console
				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentName} ${component.codeName} from ${file.fsPath} to ${origin.url} app ${origin.appId} version ${origin.appVersion}`
				);

				/** @deprecated */
				const environment = getCurrentEnvironment();
				// Upload via API
				await uploadSource({
					appName: origin.appId,
					appVersion: origin.appVersion,
					appComponentType: component.componentType,
					appComponentName: component.componentName,
					codeName: component.codeName,
					environment,
					sourcePath: component.localFile,
				});
				// Log 'done' to console
				log(
					'debug',
					`Deployed ${component.componentType} ${component.componentName} ${component.codeName} to ${origin.url} app ${origin.appId} ${origin.appVersion}`
				);
				// Handle the user "cancel" button press
				if (canceled) {
					return;
				}
			}
		}
	);
}

/**
 * Rewrites the local file defined in makecomapp.json by version from the Make cloud.
 */
async function localFileDownload(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath); // Relative to makecomapp.json
	const componentDetails = findCodeByFilename(fileRelativePath, makeappJson, makeappRootdir);

	const origin = await askForOrigin(makeappJson.origins);
	if (!origin) {
		return;
	}

	log(
		'debug',
		`Downloading/rewriting ${componentDetails.componentType} ${componentDetails.componentName} in ${file.fsPath} from ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`
	);

	/** @deprecated */
	const environment = getCurrentEnvironment();
	// Download the cloud file version into temp file
	const newTmpFile = vscode.Uri.file(tempFilename(file.fsPath));
	await downloadSource({
		appName: origin.appId,
		appVersion: origin.appVersion,
		appComponentType: componentDetails.componentType,
		appComponentName: componentDetails.componentName,
		codeName: componentDetails.codeName,
		environment,
		destinationPath: newTmpFile,
	});
	// Keep user to approve changes
	const relativeFilepath = path.relative(makeappRootdir.fsPath, file.fsPath);
	await vscode.commands.executeCommand(
		'vscode.diff',
		newTmpFile,
		file,
		`Remote ${origin.label ?? 'Origin'} ↔ ${relativeFilepath}`
	);
	// Delete temp file
	await vscode.workspace.fs.delete(newTmpFile);
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
async function askForOrigin(origins: LocalAppOrigin[], purposeLabel?: string): Promise<LocalAppOrigin | undefined> {
	if (!origins?.length) {
		throw new Error('Missing "origins" in makecomapp.json.');
	}

	if (origins.length === 1) {
		return origins[0];
	}

	const selectedOrigin = await vscode.window.showQuickPick(
		origins.map((origin, index) => {
			const label = origin.label || origin.appId + ' ' + origin.appVersion;
			return <{ origin: LocalAppOrigin } & vscode.QuickPickItem>{
				label,
				description: 'at ' + origin.url,
				picked: index === 0,
				origin: origin,
			};
		}),
		{
			ignoreFocusOut: true,
			title: 'Select the app origin' + (purposeLabel ? `for ${purposeLabel}` : '') + ':',
		}
	);
	return selectedOrigin?.origin;
}

/**
 * Opens vs code directory selector and returns the selected directory.
 * Returns undefined, when user cancels the dialog.
 */
async function askForAppDirToClone(): Promise<vscode.Uri | undefined> {
	const workspace = getCurrentWorkspace();
	const directory = await vscode.window.showInputBox({
		ignoreFocusOut: true,
		prompt: 'Enter the current workspace subdirectory, where the app will be cloned to.',
		value: 'src',
		title: 'Destination, where to clone the app',
	});
	if (!directory) {
		return undefined;
	}
	return vscode.Uri.joinPath(workspace.uri, directory);
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

interface CodePath {
	componentType: AppComponentType | 'app';
	componentName: string;
	codeName: string;
	localFile: vscode.Uri;
}

/**
 * Gets app's and component's code, which matches with the local file path.
 */
function findCodeByFilename(
	fileRelativePath: string,
	makecomappJson: MakecomappJson,
	makeappRootdir: vscode.Uri
): CodePath {
	const codes = findCodesByPath(fileRelativePath, makecomappJson, makeappRootdir);
	if (codes.length === 0) {
		throw new Error(`Code file ${fileRelativePath} is not defined in ${MAKECOMAPP_FILENAME}.`);
	}
	if (codes.length > 1) {
		throw new Error(`Multiple files unexpectedly found for ${fileRelativePath}`);
	}
	return codes[0];
}

/**
 * Gets all app's and component's codes, which matches with the local filesystem path or are in subdirectories of this path.
 * @param relativePath - If path is directory, it MUST to end with '/'.
 *                       Else horrible things can happen when some another directory has similar name
 *                       starting with same string as first one.
 * @param limit - Limits the maximum count of results. Used if expected the exact one result only. Default is unlimited.
 */
function findCodesByPath(relativePath: string, makecomappJson: MakecomappJson, makeappRootdir: vscode.Uri): CodePath[] {
	const ret: CodePath[] = [];

	// Try to find in app's direct configuration codes
	for (const [appCodeName, appCodeMetadata] of Object.entries(makecomappJson.codes)) {
		const codeIsInSubdir = appCodeMetadata.file.startsWith(relativePath);
		const codeExactMatch = appCodeMetadata.file === relativePath;
		if (codeIsInSubdir || codeExactMatch) {
			const codePath: CodePath = {
				componentType: 'app',
				componentName: '',
				codeName: appCodeName,
				localFile: vscode.Uri.joinPath(makeappRootdir, appCodeMetadata.file),
			};
			if (codeExactMatch) {
				// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
				return [codePath];
			}
			ret.push(codePath);
		}
	}

	// Try to find in compoments
	const appComponentsMetadata: AppComponentTypesMetadata = makecomappJson.components;
	/* eslint-disable guard-for-in */
	for (const componentType in appComponentsMetadata) {
		for (const componentName in appComponentsMetadata[componentType as AppComponentType]) {
			const codesMetadata: CodesMetadata =
				appComponentsMetadata[componentType as AppComponentType][componentName].codes || {};
			for (const codeName in codesMetadata) {
				const codeMetadata = codesMetadata[codeName];
				const codeIsInSubdir = codeMetadata.file.startsWith(relativePath);
				const codeExactMatch = codeMetadata.file === relativePath;
				if (codeIsInSubdir || codeExactMatch) {
					const codePath: CodePath = {
						componentType: componentType as AppComponentType,
						componentName,
						codeName,
						localFile: vscode.Uri.joinPath(makeappRootdir, codeMetadata.file),
					};
					if (codeExactMatch) {
						// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
						return [codePath];
					}
					ret.push(codePath);
				}
			}
		}
	}
	/* eslint-enable guard-for-in */
	return ret;
}

interface MakecomappJson {
	codes: Record<AppCodeName, CodeMetadata>;
	components: AppComponentTypesMetadata;
	origins: LocalAppOrigin[];
}

interface LocalAppOrigin {
	/** User friendly title */
	label?: string;
	url: string;
	appId: string;
	appVersion: number;
	apikeyFile: string;
}

type AppComponentTypesMetadata = Record<AppComponentType, AppComponentsMetadata>;

/** Component ID => def */
type AppComponentsMetadata = Record<string, AppComponentMetadata>;

interface AppComponentMetadata {
	label?: string;
	codes: CodesMetadata;
}

/** Code Name => Code metadata */
type CodesMetadata = Record<string, CodeMetadata>;
interface CodeMetadata {
	file: string;
}
