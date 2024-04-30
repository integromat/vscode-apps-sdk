import * as path from 'node:path';
import * as jsoncParser from 'jsonc-parser';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import * as vscodeLanguageclient from 'vscode-languageclient/node';
import { log } from './output-channel';
import { FunctionCommands } from './commands/FunctionCommands';
import { CommonCommands } from './commands/CommonCommands';
import { CoreCommands } from './commands/CoreCommands';
import { Environment } from './types/environment.types';
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
import TelemetryReporter from '@vscode/extension-telemetry';

let client: vscodeLanguageclient.LanguageClient;

let telemetry: TelemetryReporter;

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

	/**
	 * TELEMETRY & APP INSIGHTS START
	 */
	// start azure app insights
	startAppInsights();

	// create telemetry reporter on extension activation
	telemetry = telemetryReporter;

	// ensure it gets properly disposed. Upon disposal the events will be flushed
	context.subscriptions.push(telemetry);
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

	telemetry.dispose();
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
