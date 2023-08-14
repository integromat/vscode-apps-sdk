import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getCurrentWorkspace } from '../services/workspace';
import { AppsSdkConfigurationEnvironment, getCurrentEnvironment } from '../providers/configuration';
import { AppComponentMetadata, ComponentCodeFilesMetadata, MakecomappJson } from './types/makecomapp.types';
import App from '../tree/App';
import { askForAppDirToClone } from './ask-local-dir';
import { APIKEY_DIRNAME, MAKECOMAPP_FILENAME } from './consts';
import {
	generalCodesDefinition,
	getAppComponentCodesDefinition,
	getAppComponentTypes,
} from '../services/component-code-def';
import { CodeDef } from './types/code-def.types';
import { AppComponentType } from '../types/app-component-type.types';
import { GeneralCodeName } from '../types/general-code-name.types';
import { downloadSource } from '../services/get-code';
import {
	ComponentSummary,
	ConnectionComponentSummary,
	ModuleComponentSummary,
	WebhookComponentSummary,
	getAppComponents,
} from '../services/get-app-components';
import { camelToKebab } from '../utils/camel-to-kebab';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';
import { getModuleDefFromId } from '../services/module-types-naming';

export async function cloneAppToWorkspace(context: App): Promise<void> {
	const appName = context.name;
	const appVersion = context.version;
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
	const makecomappJson: MakecomappJson = {
		fileVersion: 1,
		generalCodeFiles: {} as any, // Missing mandatory values are filled in loop below.
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
				apikeyFile: path.relative(path.dirname(makeappJsonPath.fsPath), apikeyFileUri.fsPath),
			},
		],
	};

	if (existsSync(makeappJsonPath.fsPath)) {
		throw new Error(MAKECOMAPP_FILENAME + ' already exists in the workspace. Clone cancelled.');
	}

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
			appName,
			appVersion,
			appComponentType: 'app', // The `app` type with name `` is the special
			appComponentName: '', //
			codeName,
			environment,
			destinationPath: codeLocalAbsolutePath,
		});
		// Add to makecomapp.json
		makecomappJson.generalCodeFiles[codeName as GeneralCodeName] = codeLocalRelativePath;
	}

	// Process all app's compoments
	for (const appComponentType of getAppComponentTypes()) {
		const appComponentSummaryList = await getAppComponents<ComponentSummary>(
			appComponentType,
			appName,
			appVersion,
			environment,
		);
		// TODO Extrahovat stazeni jednotlivych komponent jako samotnou funkci

		for (const appComponentSummary of appComponentSummaryList) {
			// Create section in makecomapp.json
			const componentMetadata: AppComponentMetadata = {
				label: appComponentSummary.label,
				description: appComponentSummary.description,
			};
			switch (appComponentType) {
				case 'connection':
					componentMetadata['connectionType'] = (
						appComponentSummary as ConnectionComponentSummary
					).type;
					break;
				case 'webhook':
					componentMetadata['webhookType'] = (appComponentSummary as WebhookComponentSummary).type;
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = appComponentSummary.connection;
					// componentMetadata['altConnection'] = appComponentSummary.altConnection;
					break;
				case 'module':
					componentMetadata['moduleType'] = getModuleDefFromId(
						(appComponentSummary as ModuleComponentSummary).typeId,
					).type;
					if (componentMetadata['moduleType'] === 'action') {
						componentMetadata['actionCrud'] = (appComponentSummary as ModuleComponentSummary).crud;
					}
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = (appComponentSummary as ModuleComponentSummary).connection;
					// componentMetadata['altConnection'] = (appComponentSummary as ModuleComponentSummary).altConnection;
					break;
				case 'rpc':
					// TODO Issue: It is missing in API response
					// componentMetadata['connection'] = (appComponentSummary as RpcComponentSummary).connection;
					// componentMetadata['altConnection'] = (appComponentSummary as RpcComponentSummary).altConnection;
					break;
			}

			makecomappJson.components[appComponentType][appComponentSummary.name] = {
				...componentMetadata,
				codeFiles: await cloneComponent(
					appName,
					appVersion,
					appComponentType,
					appComponentSummary.name,
					localAppRootdir,
					environment,
					componentMetadata,
				),
			};
		}
	}

	// Write makecomapp.json app metadata file
	await fs.writeFile(makeappJsonPath.fsPath, JSON.stringify(makecomappJson, null, 4));
	// VSCode show readme.md and open explorer
	const readme = vscode.Uri.joinPath(localAppRootdir, 'readme.md');
	await vscode.commands.executeCommand('vscode.open', readme);
	await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
}

function generateDefaultLocalFilePath(
	codeDef: CodeDef,
	codeName: string,
	componentType: AppComponentType | undefined,
	componentName: string | undefined,
	appRootdir: vscode.Uri,
) {
	const filename =
		(componentName ? camelToKebab(componentName) + '.' : '') +
		// custom filename | component name
		(codeDef.filename ? codeDef.filename : codeName) +
		// file extension
		'.' +
		codeDef.fileext;

	if (!componentType || !componentName) {
		return filename;
	}

	// Add component type (like "functions", "modules",...) / [component name] subdirs

	let postfix = 0;
	let localdir: string;
	do {
		localdir = path.join(componentType + 's', camelToKebab(componentName + (postfix ? '-' + postfix : '')));
		postfix++;
	} while (false /** TODO check if directory already exists in fs, then increase postfix */);

	return path.join(localdir, filename);
}

async function cloneComponent(
	appName: string,
	appVersion: number,
	appComponentType: AppComponentType,
	appComponentName: string,
	localAppRootdir: vscode.Uri,
	environment: AppsSdkConfigurationEnvironment,
	componentMetadata: AppComponentMetadata,
): Promise<ComponentCodeFilesMetadata> {
	// Detect, which codes are appropriate to the component
	const componentCodesDef = Object.entries(getAppComponentCodesDefinition(appComponentType)).
		filter(([_codeName, codeDef]) => (!codeDef.onlyFor || codeDef.onlyFor(componentMetadata)));

	const componentCodeMetadata: ComponentCodeFilesMetadata = {};
	// Process all codes
	for (const [codeName, codeDef] of componentCodesDef) {
		// Local file path (Relative to app rootdir)
		const codeLocalRelativePath = generateDefaultLocalFilePath(
			codeDef,
			codeName,
			appComponentType,
			appComponentName,
			localAppRootdir,
		);
		const codeLocalAbsolutePath = vscode.Uri.joinPath(localAppRootdir, codeLocalRelativePath);
		// Download code from API to local file
		await downloadSource({
			appName,
			appVersion,
			appComponentType,
			appComponentName,
			codeName,
			environment,
			destinationPath: codeLocalAbsolutePath,
		});
		// Add to makecomapp.json
		componentCodeMetadata[codeName] = codeLocalRelativePath;
	}
	return componentCodeMetadata;
}
