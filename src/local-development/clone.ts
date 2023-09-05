import * as vscode from 'vscode';
import * as path from 'path';
import { existsSync } from 'fs';
import { TextEncoder } from 'util';
import pick from 'lodash.pick';
import { getCurrentWorkspace } from '../services/workspace';
import { getCurrentEnvironment } from '../providers/configuration';
import { LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';
import App from '../tree/App';
import { askForAppDirToClone } from './ask-local-dir';
import { APIKEY_DIRNAME, MAKECOMAPP_FILENAME } from './consts';
import { generalCodesDefinition } from '../services/component-code-def';
import { downloadSource } from './code-deploy-download';
import { generateDefaultLocalFilename } from './local-file-paths';
import { catchError } from '../error-handling';
import { pullNewComponents } from './pull';
import { storeSecret } from './secrets-storage';
import { withProgressDialog } from '../utils/vscode-progress-dialog';
import { entries } from '../utils/typed-object';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.clone-to-workspace',
		catchError(
			'Download app to workspace',
			cloneAppToWorkspace,
		),
	);
}

/**
 * Clones whole app from Make cloud to the local repository
 */
async function cloneAppToWorkspace(context: App): Promise<void> {
	const workspaceRoot = getCurrentWorkspace().uri;
	const apikeyDir = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME);

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

	const apikeyFileUri = await storeSecret('apikey', environment.apikey);

	const origin: LocalAppOriginWithSecret = {
		label: 'Origin',
		baseUrl: 'https://' + environment.url,
		appId: context.name,
		appVersion: context.version,
		apikeyFile: path.relative(localAppRootdir.fsPath, apikeyFileUri.fsPath),
		apikey: environment.apikey,
	};

	const makecomappJson: MakecomappJson = {
		fileVersion: 1,
		generalCodeFiles: {} as any, // Missing mandatory values are filled in loop below.
		components: {
			connection: {},
			module: {},
			function: {},
			rpc: {},
			webhook: {},
		},
		origins: [pick(origin, ['label', 'baseUrl', 'appId', 'appVersion', 'apikeyFile'])],
	};

	// Save .gitignore: exclude secrets dir, common data.
	const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
	const secretsDirRelativeToWorkspaceRoot = path.relative(workspaceRoot.fsPath, apikeyDir.fsPath);
	const gitignoreLines: string[] = ['common.json', '*.common.json', secretsDirRelativeToWorkspaceRoot];
	const gitignoreContent = new TextEncoder().encode(gitignoreLines.join('\n') + '\n');
	await vscode.workspace.fs.writeFile(gitignoreUri, gitignoreContent);
	// Create apikey file
	const apiKeyFileContent = new TextEncoder().encode(environment.apikey + '\n');
	await vscode.workspace.fs.writeFile(apikeyFileUri, apiKeyFileContent);

	await withProgressDialog({ title: `Cloning app ${origin.appId}` }, async () => {

		// #region Process all app's general codes
		for (const [codeName, codeDef] of entries(generalCodesDefinition)) {
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
			makecomappJson.generalCodeFiles[codeName] = codeLocalRelativePath;
		}
		// #endregion Process all app's general codes

		// Write makecomapp.json app metadata file
		await vscode.workspace.fs.writeFile(
			makeappJsonPath,
			new TextEncoder().encode(JSON.stringify(makecomappJson, null, 4)),
		);
		// Pull all app's components
		await pullNewComponents(localAppRootdir, origin);

		// VSCode show readme.md and open explorer
		const readmeUri = vscode.Uri.joinPath(
			localAppRootdir,
			generalCodesDefinition.readme.filename + '.' + generalCodesDefinition.readme.fileext,
		);
		await vscode.commands.executeCommand('vscode.open', readmeUri);
		await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
	});
}
