// set the vscode lib wrapper mode to ide
import { vscodeLibWrapperFactory } from './services/vscode-lib-wraper';
vscodeLibWrapperFactory.setMode('ide');

import * as path from 'node:path';
import * as jsoncParser from 'jsonc-parser';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import * as vscodeLanguageclient from 'vscode-languageclient/node';
import { log } from './output-channel';
import { FunctionCommands } from './commands/FunctionCommands';
import { CommonCommands } from './commands/CommonCommands';
import { CoreCommands } from './commands/CoreCommands';
import type { Environment } from './types/environment.types';
import { rmCodeLocalTempBasedir, sourceCodeLocalTempBasedir } from './temp-dir';
import { isPreReleaseVersion, version } from './Meta';
import {
	AppsSdkConfiguration,
	AppsSdkConfigurationEnvironment,
	getConfiguration,
	getCurrentEnvironment,
} from './providers/configuration';
import { registerCommandForLocalDevelopment } from './local-development';
import * as LanguageServersSettings from './LanguageServersSettings';
import { AppsProvider } from './providers/AppsProvider';
import { OpensourceProvider } from './providers/OpensourceProvider';
import ImljsonHoverProvider = require('./providers/ImljsonHoverProvider');
import RpcCommands = require('./commands/RpcCommands');
import ModuleCommands = require('./commands/ModuleCommands');
import WebhookCommands = require('./commands/WebhookCommands');
import ConnectionCommands = require('./commands/ConnectionCommands');
import AppCommands = require('./commands/AppCommands');
import ChangesCommands = require('./commands/ChangesCommands');
import AccountCommands = require('./commands/AccountCommands');
import EnvironmentCommands = require('./commands/EnvironmentCommands');
import PublicCommands = require('./commands/PublicCommands');
import { telemetryReporter, sendTelemetry, startAppInsights } from './utils/telemetry';
import { getMakecomappJson, getMakecomappRootDir } from './local-development/makecomappjson';
import { type AppComponentType, AppComponentTypes } from './types/app-component-type.types';
import { deleteLocalComponent } from './local-development/delete-local-component';
import { catchError } from './error-handling';
import { camelToKebab } from './utils/camel-to-kebab';

let client: vscodeLanguageclient.LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
	log('debug', `Extension ${version} starting...`);

	// Write context `isPreReleaseVersion`. Used in `package.json` -> `when` conditions.
	vscode.commands.executeCommand('setContext', 'isPreReleaseVersion', isPreReleaseVersion);

	let _authorization: string | undefined = undefined;
	let _environment: Environment | undefined = undefined;
	let _admin = false;

	let _configuration = getConfiguration();

	// Backward Compatibility Layer - Transform Old Config Format to the New One
	if (typeof _configuration.environments === 'object' && !Array.isArray(_configuration.environments)) {
		console.debug('Old Environment Configuration Schema detected - transforming');

		// RAW copy of environments, because _configuration is read only
		const oldEnvironments = JSON.parse(JSON.stringify(_configuration.environments));

		// Build new Envs
		let currentEnvUuid;
		const newEnvironments = Object.keys(oldEnvironments).map((url) => {
			const e = Object.assign({}, oldEnvironments[url], { url: url });
			const uuid = uuidv4();
			e.uuid = uuid;
			if (url === _configuration.environment) {
				currentEnvUuid = uuid;
			}
			return e;
		});
		// Store
		await Promise.all([
			_configuration.update('environments', newEnvironments, 1),
			_configuration.update('environment', currentEnvUuid, 1),
		]);
		// Reload
		_configuration = getConfiguration();
	}

	// Prepare the IMLJSON language server module and create a new language client
	// Note: Used the little updated original JSON language server from Microsoft VSCode.
	//       See file://./../syntaxes/imljson-language-features/README.md
	const serverModuleFile = context.asAbsolutePath(
		path.join('out', 'imljson-language-features', 'server', 'node', 'jsonServerMain.js'),
	);
	client = new vscodeLanguageclient.LanguageClient(
		'imljsonLanguageServer',
		'IMLJSON language server',
		LanguageServersSettings.buildServerOptions(serverModuleFile),
		LanguageServersSettings.clientOptions,
	);
	// Start the client. This will also launch the server
	await client.start();

	// Register all JSON schemas for IMLJSON language
	await client.sendNotification(
		new vscodeLanguageclient.NotificationType('imljson/schemaAssociations'),
		LanguageServersSettings.getJsonSchemas(),
	);

	// Environment commands and envChanger
	const envChanger = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10);
	envChanger.tooltip = 'Click to change your working environment';
	const currentEnvironmentOrUndefined = getCurrentEnvironmentOrUndefined();
	if (currentEnvironmentOrUndefined) {
		envChanger.text = `$(server) ${currentEnvironmentOrUndefined.name}`;
	} else {
		envChanger.text = '$(server) ENVIRONMENT NOT SET';
	}
	envChanger.command = 'apps-sdk.env.change';
	envChanger.show();

	await EnvironmentCommands.register(envChanger, _configuration);
	await PublicCommands.register();

	/**
	 * First launch -> there are no environments
	 */
	if (Object.keys(_configuration.environments).length === 0) {
		setImmediate(() => {
			// Run after the extension activation (because of automated tests)
			(async () => {
				const input = await vscode.window.showWarningMessage(
					'You have no environments set up yet. If you want to start using Apps SDK, you have to add a new one.',
					'Add environment',
				);
				if (input === 'Add environment') {
					vscode.commands.executeCommand('apps-sdk.env.add');
				}
			})();
		});
		log('info', 'Extension activated in limited mode (no environment set, user asked to add one).');
		return;
	}

	if (getCurrentEnvironmentOrUndefined()) {
		await AccountCommands.register(_configuration);

		const currentEnvironment = getCurrentEnvironment();
		// If environment is set, but there's no API key in the configuration
		if (currentEnvironment.apikey === '') {
			const input = await vscode.window.showWarningMessage(
				'Your API key for this environment is not set. Please login first.',
				'Login',
			);
			if (input === 'Login') {
				vscode.commands.executeCommand('apps-sdk.login');
			}
		}

		// Else -> the environment is set and it contains API key -> set (pseudo)global variables and continue
		else {
			_authorization = 'Token ' + currentEnvironment.apikey;
			// If API version not set or it's 1
			if (!currentEnvironment.version || currentEnvironment.version === 1) {
				_environment = {
					baseUrl: `https://${currentEnvironment.url}/v1`,
					version: 1,
				};
			} else {
				// API V2 and development purposes
				// configuration.unsafe removes https
				// configuration.noVersionPath removes vX in path
				_environment = {
					baseUrl: `http${currentEnvironment.unsafe === true ? '' : 's'}://${currentEnvironment.url}${
						currentEnvironment.noVersionPath === true ? '' : `/v${currentEnvironment.version}`
					}${currentEnvironment.admin === true ? '/admin' : ''}`,
					version: currentEnvironment.version,
				};
			}
			_admin = currentEnvironment.admin === true;
		}
	}

	// For new users, who don't have any environment set up yet
	if (!_environment || !_authorization) {
		log('info', 'Extension activated in limited mode (no active environment set).');
		return;
		// Note: Environment commands are registered, so user can add new environment (or choose exiting) and activate it.
		//       Then command `apps-sdk.env.change` will execute the extension reload to register all other below.
	}

	/**
	 * AUTHORIZED
	 * Following stuff is done only when environment and API key are set correctly (_authorization variable was set -> it isn't undefined)
	 */

	/**
	 * Registering providers
	 */
	vscode.languages.registerHoverProvider({ language: 'imljson', scheme: 'file' }, new ImljsonHoverProvider());
	vscode.window.registerTreeDataProvider(
		'opensource',
		new OpensourceProvider(_authorization, _environment, sourceCodeLocalTempBasedir),
	);

	const appsProvider = new AppsProvider(_authorization, _environment, sourceCodeLocalTempBasedir, _admin);
	vscode.window.registerTreeDataProvider('apps', appsProvider);

	/**
	 * Registering commands
	 */
	const coreCommands = new CoreCommands(appsProvider, _authorization, _environment);
	await CoreCommands.register(sourceCodeLocalTempBasedir, _authorization, _environment);
	await AppCommands.register(appsProvider, _authorization, _environment, _admin);
	await ConnectionCommands.register(appsProvider, _authorization, _environment);
	await WebhookCommands.register(appsProvider, _authorization, _environment);
	await ModuleCommands.register(appsProvider, _authorization, _environment);
	await RpcCommands.register(appsProvider, _authorization, _environment);
	await FunctionCommands.register(appsProvider, _authorization, _environment, _configuration.timezone);
	await CommonCommands.register(appsProvider, _authorization, _environment);
	await ChangesCommands.register(appsProvider, _authorization, _environment);
	registerCommandForLocalDevelopment();

	/**
	 * Registering events
	 */
	vscode.workspace.onWillSaveTextDocument((event) => coreCommands.sourceUpload(event));
	vscode.window.onDidChangeActiveTextEditor((editor) => coreCommands.keepProviders(editor));

	/**
	 * Registering JSONC formatter
	 */
	vscode.languages.registerDocumentFormattingEditProvider(
		{ language: 'imljson', scheme: 'file' },
		{
			provideDocumentFormattingEdits(document) {
				const text = document.getText();
				const edits = jsoncParser.format(text, undefined, { keepLines: true });
				return edits.map((edit) => {
					const start = document.positionAt(edit.offset);
					const end = document.positionAt(edit.offset + edit.length);
					return vscode.TextEdit.replace(new vscode.Range(start, end), edit.content);
				});
			},
		},
	);

	// Component deletion context menu.
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.delete-local-component',
		// Delete folder will trigger file watcher

		// add await vscode.workspace.fs.delete(uri, { recursive: true }); instead removeRecursively
		catchError('Delete local component', async (uri) => {
			await vscode.workspace.fs.delete(uri, { recursive: true });
		}),
	);

	function parseComponentPath(
		componentPath: string,
	): { componentType: AppComponentType; componentName: string } | null {
		// Parse path
		const pathParts = componentPath.split('/');

		// Should contain componentType and componentName
		if (pathParts.length < 2) {
			return null;
		}

		// Get last two parts of path
		const [componentTypePlural, componentName] = pathParts.slice(-2);

		// Remove plural 's' character
		const componentType = componentTypePlural.slice(0, -1) as AppComponentType;

		// Test kebab-case pattern (min 3 chars)
		const isValidComponentName = /^[a-z][0-9a-z-]+[0-9a-z]$/.test(componentName); // folder is component kebab-case-name
		const isValidComponentType = AppComponentTypes.includes(componentType);

		if (isValidComponentName && isValidComponentType) {
			return { componentType: componentType as AppComponentType, componentName };
		}

		// Folder is not related to any component
		return null;
	}

	async function onFileDeleted(uri: vscode.Uri) {
		const foundComponentInPath = parseComponentPath(uri.path);

		// Path is not related to component.
		if (!foundComponentInPath) {
			return;
		}

		const makecomappJson = await getMakecomappJson(uri);
		// The path is a valid component but is not listed in the manifest, so no action will be executed.
		const componentNames = Object.keys(makecomappJson.components[foundComponentInPath.componentType]);

		// Component folders are derived as kebab-case of component name so some 'find' is here.
		const foundComponent = componentNames.find((componentName) => {
			return camelToKebab(componentName) === foundComponentInPath.componentName;
		});
		if (!foundComponent) {
			return;
		}

		// The path is valid existing component, proceed with its deletion.
		const rootDir = getMakecomappRootDir(uri);
		await deleteLocalComponent(rootDir, foundComponentInPath.componentType as AppComponentType, foundComponent);
	}

	// Observe file/folder deletion even from external file explorer.
	const watcher = vscode.workspace.createFileSystemWatcher('**/*');
	watcher.onDidDelete(onFileDeleted);
	context.subscriptions.push(watcher);

	/**
	 * TELEMETRY & APP INSIGHTS START
	 */
	// start azure app insights
	startAppInsights();

	// ensure it gets properly disposed. Upon disposal the events will be flushed
	context.subscriptions.push(telemetryReporter);
	sendTelemetry('activated', { version: _environment.version });

	log('info', 'Extension fully activated with environment ' + _environment.baseUrl);
}

export async function deactivate() {
	// Delete local temp dir
	rmCodeLocalTempBasedir();

	// Stop the language server client
	if (!client) {
		return undefined;
	}
	log('info', 'Deactivating the Extension ...');
	await client.stop();

	telemetryReporter.dispose();
}

/**
 * User can define multiple environmnents.
 * Function returns the one that is currently selected by user.
 */
function getCurrentEnvironmentOrUndefined(): AppsSdkConfigurationEnvironment | undefined {
	const _configuration = getConfiguration();
	return _configuration
		.get<AppsSdkConfiguration['environments']>('environments')
		?.find((e: any) => e.uuid === _configuration.environment);
}

/**
 * Exported for automated testing purpose only
 */
export function testsOnly_getImljsonLanguageClient() {
	return client;
}
