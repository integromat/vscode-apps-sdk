import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { TextEncoder } from 'node:util';
import pick from 'lodash/pick';
import * as vscode from 'vscode';
import { LocalAppOrigin, LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';
import { askForAppDirToClone } from './ask-local-dir';
import { APIKEY_DIRNAME, MAKECOMAPP_FILENAME } from './consts';
import { generateDefaultLocalFilename } from './local-file-paths';
import { pullAllComponents } from './pull';
import { storeSecret } from './secrets-storage';
import { getCurrentWorkspace } from '../services/workspace';
import { getCurrentEnvironment } from '../providers/configuration';
import App from '../tree/App';
import { generalCodesDefinition } from '../services/component-code-def';
import { catchError } from '../error-handling';
import { withProgressDialog } from '../utils/vscode-progress-dialog';
import { entries } from '../utils/typed-object';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.clone-to-workspace',
		catchError('Clone app to workspace', cloneAppToWorkspace),
	);
}

/**
 * Clones whole app from Make cloud to the local repository
 */
async function cloneAppToWorkspace(context: App): Promise<void> {
	const workspaceRoot = getCurrentWorkspace().uri;
	const apikeyDir = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME);

	// Introductory info dialog "Before use"
	const confirmAnswer = await vscode.window.showInformationMessage(
		'Before use the Local Development for Apps',
		{
			modal: true,
			detail:
				'ABOUT LOCAL DEVELOPMENT FOR APPS:' +
				'\n\n' +
				'This feature enables you to clone your app from Make to the currently opened VS Code workspace (folder). ' +
				'After cloning, your app will be placed in a local folder as local files, with the "makecomapp.json" file located in the project root. ' +
				'This "makecomapp.json" serves as the starting point for the entire local structure. ' +
				'To explore available actions for your locally cloned app, simply right-click on the "makecomapp.json" file. ' +
				'These actions allow you to deploy all local changes back to Make, among other things.' +
				'\n\n' +
				'RECOMMENDATION AFTER CLONNING:' +
				'\n\n' +
				'We recommend initializing a GIT repository and committing the entire local project there.' +
				'\n\n' +
				'THIS FEATURE IS BETA:' +
				'\n\n' +
				'It means that some features may be missing or not yet finalized. ' +
				'If any errors occur, consider removing local files and cloning again, or reverting to a previous GIT commit.',
		},
		{ title: 'Continue' },
	);
	if (confirmAnswer?.title !== 'Continue') {
		return;
	}

	const localAppRootdir = await askForAppDirToClone();
	if (!localAppRootdir) {
		// Cancelled by user
		return;
	}

	// Ask to "Clone common data? Yes/No"
	const commonDataAnswer = await vscode.window.showInformationMessage(
		'Include also all common data?',
		{
			modal: true,
			detail:
				'COMMON DATA INCLUDE/EXCLUDE:' +
				'\n\n' +
				'Common data could contain sensitive data or secrets. It depends on your app design. ' +
				'We recommend that you exclude common data files from the local clone of the application. ' +
				'If you decide to include it, be aware that these common data files will also be part of your GIT commits.',
		},
		{ title: 'Exclude (more secure)' },
		{ title: 'Include (for advanced users only)' },
	);
	if (!commonDataAnswer) {
		// Cancelled by user
		return;
	}

	const includeCommonData = commonDataAnswer.title.startsWith('Include');

	const environment = getCurrentEnvironment();

	const makeappJsonPath = vscode.Uri.joinPath(localAppRootdir, MAKECOMAPP_FILENAME); // TODO rename to `makecomappJsonPath`
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
		idMapping: {
			connection: [],
			module: [],
			function: [],
			rpc: [],
			webhook: [],
		},
		apikeyFile: path.posix.relative(localAppRootdir.path, apikeyFileUri.path),
		apikey: environment.apikey,
	};
	const originWithoutApiKey: LocalAppOrigin = pick(origin, [
		'label',
		'baseUrl',
		'appId',
		'appVersion',
		'idMapping',
		'apikeyFile',
	]);

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
		origins: [originWithoutApiKey],
	};

	// Save .gitignore: exclude secrets dir.
	const gitignoreUri = vscode.Uri.joinPath(workspaceRoot, '.gitignore');
	const secretsDirRelativeToWorkspaceRoot = path.posix.relative(workspaceRoot.path, apikeyDir.path);
	const gitignoreLines: string[] = [secretsDirRelativeToWorkspaceRoot];
	const gitignoreContent = new TextEncoder().encode(gitignoreLines.join('\n') + '\n');
	await vscode.workspace.fs.writeFile(gitignoreUri, gitignoreContent);
	// Create apikey file
	const apiKeyFileContent = new TextEncoder().encode(environment.apikey + '\n');
	await vscode.workspace.fs.writeFile(apikeyFileUri, apiKeyFileContent);

	await withProgressDialog({ title: `Cloning app ${origin.appId}` }, async () => {
		// #region Process all app's general codes
		for (const [codeType, codeDef] of entries(generalCodesDefinition)) {
			const codeLocalRelativePath = await generateDefaultLocalFilename(
				// Note: target directories "general" and "modules" are defined in `codeDef`.
				codeDef,
				codeType,
				undefined,
				undefined,
				undefined,
			);
			// Add to makecomapp.json
			makecomappJson.generalCodeFiles[codeType] =
				codeType === 'common' && !includeCommonData ? null : codeLocalRelativePath;
		}
		// #endregion Process all app's general codes

		// Write makecomapp.json app metadata file
		await vscode.workspace.fs.writeFile(
			makeappJsonPath,
			new TextEncoder().encode(JSON.stringify(makecomappJson, null, 4)),
		);

		// Pull all app's components
		await pullAllComponents(localAppRootdir, origin, 'cloneAsNew');

		// VSCode show readme.md and open explorer
		const readmeUri = vscode.Uri.joinPath(
			localAppRootdir,
			generalCodesDefinition.readme.filename + '.' + generalCodesDefinition.readme.fileext,
		);
		await vscode.commands.executeCommand('vscode.open', readmeUri);
		await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
	});
}
