import * as vscode from 'vscode';
import vscode_languageclient = require("vscode-languageclient");
import { log } from './output-channel';

import AppsProvider = require('./providers/AppsProvider');
import OpensourceProvider = require('./providers/OpensourceProvider');
import ImljsonHoverProvider = require('./providers/ImljsonHoverProvider');

import RpcCommands = require('./commands/RpcCommands');
import FunctionCommands = require('./commands/FunctionCommands');
import ModuleCommands = require('./commands/ModuleCommands');
import WebhookCommands = require('./commands/WebhookCommands');
import ConnectionCommands = require('./commands/ConnectionCommands');
import AppCommands = require('./commands/AppCommands');
import { CommonCommands } from './commands/CommonCommands';
import ChangesCommands = require('./commands/ChangesCommands');
import AccountCommands = require('./commands/AccountCommands');
import CoreCommands = require('./commands/CoreCommands');
import EnvironmentCommands = require('./commands/EnvironmentCommands');
import PublicCommands = require('./commands/PublicCommands');

import LanguageServersSettings = require('./LanguageServersSettings');

import * as path from 'path';
import * as jsoncParser from 'jsonc-parser';
import { v4 as uuidv4 } from 'uuid';
import { Environment } from './types/environment.types';
import { rmCodeLocalTempBasedir, sourceCodeLocalTempBasedir } from './temp-dir';
import { version } from './Meta';


let client: vscode_languageclient.LanguageClient;


export async function activate(context: vscode.ExtensionContext) {
	log('debug', `Extension ${version} starting...`);

	let _authorization: string|undefined = undefined;
	let _environment: Environment | undefined = undefined;
	let _admin = false;
	let currentRpcProvider;
	let currentImlProvider;
	let currentParametersProvider;
	let currentStaticImlProvider;
	let currentTempProvider;
	let currentDataProvider;
	let currentGroupsProvider;


	let _configuration = vscode.workspace.getConfiguration('apps-sdk') as AppsSdkConfiguration;
	console.log('Apps SDK active.');

	// Backward Compatibility Layer - Transform Old Config Format to the New One
	if (typeof _configuration.environments === 'object' && !(Array.isArray(_configuration.environments))) {
		console.debug('Old Environment Configuration Schema detected - transforming');

		// RAW copy of environments, because _configuration is read only
		const oldEnvironments = JSON.parse(JSON.stringify(_configuration.environments));

		// Build new Envs
		let currentEnvUuid;
		const newEnvironments = Object.keys(oldEnvironments).map(url => {
			const e = Object.assign({}, oldEnvironments[url], { url: url });
			const uuid = uuidv4();
			e.uuid = uuid;
			if (url === _configuration.environment) {
				currentEnvUuid = uuid;
			}
			return e;
		});
		// Store
		await Promise.all([_configuration.update('environments', newEnvironments, 1), _configuration.update('environment', currentEnvUuid, 1)]);
		// Reload
		_configuration = vscode.workspace.getConfiguration('apps-sdk') as AppsSdkConfiguration;
	}

	/**
	 * IMLJSON language server
	 */

	// Prepare the server module and create a new language client
	const serverModule = context.asAbsolutePath(path.join('syntaxes', 'languageServers', 'imlJsonServerMain.js'));
	client = new vscode_languageclient.LanguageClient('imljsonLanguageServer', 'IMLJSON language server', LanguageServersSettings.buildServerOptions(serverModule), LanguageServersSettings.clientOptions);

	// Start the client. This will also launch the server
	client.start();

	// When the client is ready, send IMLJSON schemas to the server
	client.onReady().then(() => {
		client.sendNotification(new vscode_languageclient.NotificationType('imljson/schemaAssociations'), LanguageServersSettings.getJsonSchemas());
	});

	// Environment commands and envChanger
	const envChanger = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10);
	envChanger.tooltip = "Click to change your working environment";
	const currentEnvironmentOrUndefined = getCurrentEnvironmentOrUndefined();
	if (currentEnvironmentOrUndefined) {
		envChanger.text = `$(server) ${currentEnvironmentOrUndefined.name}`;
	} else {
		envChanger.text = `$(server) ENVIRONMENT NOT SET`;
	}
	envChanger.command = "apps-sdk.env.change";
	envChanger.show();

	await EnvironmentCommands.register(envChanger, _configuration);
	await PublicCommands.register();

	/**
	 * First launch -> there are no environments
	 */
	if (Object.keys(_configuration.environments).length === 0) {
		const input = await vscode.window.showWarningMessage("You have no environments set up yet. If you want to start using Apps SDK, you have to add a new one.", "Add environment");
		if (input === "Add environment") {
			vscode.commands.executeCommand('apps-sdk.env.add');
		}
	}

	if (getCurrentEnvironmentOrUndefined()) {

		await AccountCommands.register(_configuration);

		const currentEnvironment = getCurrentEnvironment();
		// If environment is set, but there's no API key in the configuration
		if (currentEnvironment.apikey === "") {
			const input = await vscode.window.showWarningMessage("Your API key for this environment is not set. Please login first.", "Login");
			if (input === "Login") {
				vscode.commands.executeCommand("apps-sdk.login");
			}
		}

		// Else -> the environment is set and it contains API key -> set (pseudo)global variables and continue
		else {
			_authorization = "Token " + currentEnvironment.apikey;
			// If API version not set or it's 1
			if (!(currentEnvironment.version) || currentEnvironment.version === 1) {
				_environment = {
					baseUrl: `https://${currentEnvironment.url}/v1`,
					version: 1
				};
			} else {
				// API V2 and development purposes
				// configuration.unsafe removes https
				// configuration.noVersionPath removes vX in path
				_environment = {
					baseUrl: `http${currentEnvironment.unsafe === true ? '' : 's'}://${currentEnvironment.url}${currentEnvironment.noVersionPath === true ? '' : `/v${currentEnvironment.version}`}${currentEnvironment.admin === true ? '/admin' : ''}`,
					version: currentEnvironment.version
				};
			}
			_admin = (currentEnvironment.admin === true);
		}
	}

	if (!_environment) {
		throw new Error("_environment not set.");  // This should never happen, it is here just for TypeScript to be happy.
	}

	/**
	 * AUTHORIZED
	 * Following stuff is done only when environment and API key are set correctly (_authorization variable was set -> it isn't undefined)
	 */
	if (_authorization) {

		/**
		 * Registering providers
		 */
		vscode.languages.registerHoverProvider({ language: 'imljson', scheme: 'file' }, new ImljsonHoverProvider());
		vscode.window.registerTreeDataProvider('opensource', new OpensourceProvider(_authorization, _environment, sourceCodeLocalTempBasedir));

		const appsProvider = new AppsProvider(_authorization, _environment, sourceCodeLocalTempBasedir, _admin);
		vscode.window.registerTreeDataProvider('apps', appsProvider);

		/**
		 * Registering commands
		 */
		const coreCommands = new CoreCommands(appsProvider, _authorization, _environment, currentRpcProvider, currentImlProvider, currentParametersProvider, currentStaticImlProvider, currentTempProvider, currentDataProvider, currentGroupsProvider);
		await CoreCommands.register(sourceCodeLocalTempBasedir, _authorization, _environment);
		await AppCommands.register(appsProvider, _authorization, _environment, _admin);
		await ConnectionCommands.register(appsProvider, _authorization, _environment);
		await WebhookCommands.register(appsProvider, _authorization, _environment);
		await ModuleCommands.register(appsProvider, _authorization, _environment);
		await RpcCommands.register(appsProvider, _authorization, _environment);
		await FunctionCommands.register(appsProvider, _authorization, _environment, _configuration.timezone);
		await CommonCommands.register(appsProvider, _authorization, _environment);
		await ChangesCommands.register(appsProvider, _authorization, _environment);

		/**
		 * Registering events
		 */
		vscode.workspace.onWillSaveTextDocument(event => coreCommands.sourceUpload(event));
		vscode.window.onDidChangeActiveTextEditor(editor => coreCommands.keepProviders(editor));


		/**
		 * Registering JSONC formatter
		 */
		vscode.languages.registerDocumentFormattingEditProvider({ language: 'imljson', scheme: 'file' }, {
			provideDocumentFormattingEdits(document) {
				const text = document.getText();
				const edits = jsoncParser.format(text, undefined, { insertSpaces: true, tabSize: 4, keepLines: true });
				return edits.map(edit => {
					const start = document.positionAt(edit.offset);
					const end = document.positionAt(edit.offset + edit.length);
					return vscode.TextEdit.replace(new vscode.Range(start, end), edit.content);
				});
			}
		});
	}

	log('info', 'Extension activated');
}


export function deactivate() {
	// Delete local temp dir
	rmCodeLocalTempBasedir();

	//Stop the language server client
	if (!client) {
		return undefined;
	}
	log('info', 'Deactivating the Extension ...');
	return client.stop();
}


/**
 * User can define multiple environmnents.
 * Function returns the one that is currently selected by user.
 */
function getCurrentEnvironmentOrUndefined(): AppsSdkConfigurationEnvironment | undefined {
	const _configuration = vscode.workspace.getConfiguration('apps-sdk');
	return _configuration
		.get<AppsSdkConfiguration['environments']>('environments')
		?.find((e: any) => e.uuid === _configuration.environment);
}


/**
 * User can define multiple environmnents.
 * Function returns the one that is currently selected by user.
 *
 * @throws {Error} If no environment is selected or if selected environment is not found in the configuration.
 */
function getCurrentEnvironment(): AppsSdkConfigurationEnvironment {
	const _configuration = vscode.workspace.getConfiguration('apps-sdk');
	const environments = _configuration.get<AppsSdkConfiguration['environments']>('environments');
	if (!environments) {
		const err = "No configuration found in 'apps-sdk.environments'. Check your configuration.";
		log('error', err);
		throw new Error(err);
	}
	const selectedEnvironment = environments.find((e: any) => e.uuid === _configuration.environment);
	if (!selectedEnvironment) {
		throw new Error("Selected environment ('apps-sdk.environment') not found in 'apps-sdk.environments'. Check your configuration.");
	}
	return selectedEnvironment;
}


/**
 * Describes the configuration structure of key `apps-sdk` in the VS Code configuration file.
 */
interface AppsSdkConfiguration extends vscode.WorkspaceConfiguration {
	login: boolean;
	environments: AppsSdkConfigurationEnvironment[];
	environment: AppsSdkConfigurationEnvironment['uuid'];
}


interface AppsSdkConfigurationEnvironment {
	name: string;
	uuid: string;
	apikey: string;
	version: number;
	url: string;

	unsafe?: boolean;
	noVersionPath?: boolean;
	admin?: boolean;
}
