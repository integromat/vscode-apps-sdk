import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as jsoncParser from 'jsonc-parser';
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
import {
	getStaticAndDerivedSchemaAssociations,
	ImljsonSchemaAssociations,
	schemaAssociationsNotificationType,
} from './services/imljson-schema-associations';
import { AppsProvider } from './providers/AppsProvider';
import { OpensourceProvider } from './providers/OpensourceProvider';
import ImljsonHoverProvider = require('./providers/ImljsonHoverProvider');
import { ComponentReferenceHoverProvider } from './providers/ComponentReferenceHoverProvider';
import Code from './tree/Code';
import RpcCommands = require('./commands/RpcCommands');
import { EndpointCommands } from './commands/EndpointCommands';
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
import { contextGuard, pathDeterminer } from './Core';

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
			const uuid = randomUUID();
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
	await client.sendNotification(schemaAssociationsNotificationType, getStaticAndDerivedSchemaAssociations());

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
			// configuration.unsafe removes https
			// configuration.noVersionPath removes vX in path
			_environment = {
				baseUrl: `http${currentEnvironment.unsafe === true ? '' : 's'}://${currentEnvironment.url}${
					currentEnvironment.noVersionPath === true ? '' : `/v${currentEnvironment.version}`
				}${currentEnvironment.admin === true ? '/admin' : ''}`,
			};
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
	const appsTreeView = vscode.window.createTreeView('apps', { treeDataProvider: appsProvider });

	function updateSearchContext() {
		const isActive = appsProvider.searchFilter.length > 0;
		vscode.commands.executeCommand('setContext', 'apps-sdk.searchActive', isActive);
		appsTreeView.description = isActive ? `Filter: "${appsProvider.searchFilter}"` : undefined;
	}

	vscode.commands.registerCommand('apps-sdk.search', catchError('Search custom apps', async () => {
		const term = await vscode.window.showInputBox({
			prompt: 'Search custom apps by name, label, or description',
			placeHolder: 'Type to filter apps…',
			value: appsProvider.searchFilter,
		});
		if (term !== undefined) {
			appsProvider.setSearchFilter(term);
			updateSearchContext();
		}
	}));

	vscode.commands.registerCommand('apps-sdk.search.clear', catchError('Clear custom apps search', async () => {
		appsProvider.clearSearchFilter();
		updateSearchContext();
	}));

	vscode.commands.registerCommand('apps-sdk.app.search-components', catchError('Search app components', async (app) => {
		if (!contextGuard(app)) {
			return;
		}

		const { components, failedGroups } = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Loading components of ${app.bareLabel}…` },
			() => appsProvider.getAppComponentsSummary(app),
		);

		if (components.length === 0) {
			// Only claim the app is empty when nothing failed; a failed fetch already surfaced an
			// error dialog (via rpGet), so showing "No components found" on top would be misleading.
			if (failedGroups.length === 0) {
				vscode.window.showInformationMessage('No components found in this app.');
			}
			return;
		}

		const items = components.map((summary: any) => ({
			label: summary.label,
			// `description` (the raw name/id) and `detail` are matched on too, so a name that
			// differs from the label is still searchable.
			description: summary.name,
			detail: summary.supertype + (summary.description ? ` — ${summary.description}` : ''),
			summary,
		}));

		const picked = await vscode.window.showQuickPick(items, {
			matchOnDescription: true,
			matchOnDetail: true,
			placeHolder: 'Search components by name or label',
		});
		if (picked === undefined) {
			return;
		}

		// Rebuild the component's tree node and reveal it. Deliberately NOT calling refresh()
		// (that would clear the icon cache and restart background loading).
		const item = appsProvider.buildComponentTreeItem(app, picked.summary);
		await appsTreeView.reveal(item, { select: true, focus: true, expand: true });
	}));

	// Hover-to-open for component references (rpc://Name and custom IML function calls) in app code.
	// Captured as const so the values stay narrowed (non-undefined) inside the command closure below.
	const environment = _environment;
	vscode.languages.registerHoverProvider(
		[
			{ language: 'imljson', scheme: 'file' },
			{ language: 'javascript', scheme: 'file' },
		],
		new ComponentReferenceHoverProvider(_authorization, environment),
	);

	vscode.commands.registerCommand(
		'apps-sdk.open-referenced-component',
		catchError('Open referenced component', async (target) => {
			if (!target) {
				return;
			}

			// Local-development mode: the code file is already resolved to an on-disk URI.
			if (target.mode === 'local') {
				const uri = vscode.Uri.parse(target.fileUri);
				await vscode.window.showTextDocument(uri, { preview: true });
				await vscode.commands.executeCommand('revealInExplorer', uri);
				return;
			}

			// Online mode: rebuild the tree nodes, open the code via the shared loader, and reveal it.
			const appNode = {
				id: `${target.appName}@${target.appVersion}`,
				name: target.appName,
				version: target.appVersion,
				parent: undefined,
			};
			const { components } = await appsProvider.getAppComponentsSummary(appNode);
			const summary = components.find(
				(component: any) => component.supertype === target.supertype && component.name === target.componentName,
			);
			if (!summary) {
				vscode.window.showWarningMessage(`Component "${target.componentName}" was not found in the app.`);
				return;
			}

			const item = appsProvider.buildComponentTreeItem(appNode, summary);
			// RPC code lives in the "api" (imljson) file; function code in the "code" (js) file.
			const codeName = target.supertype === 'rpc' ? 'api' : 'code';
			const language = target.supertype === 'rpc' ? 'imljson' : 'js';
			const apiPath = pathDeterminer(environment.version, target.supertype);
			const codeNode = new (Code as any)(codeName, codeName, item, language, apiPath, false, null, undefined);

			await vscode.commands.executeCommand('apps-sdk.load-source', codeNode);
			await appsTreeView.reveal(item, { select: true, focus: true, expand: true });
		}),
	);

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
	await EndpointCommands.register(appsProvider, _authorization, _environment);
	await FunctionCommands.register(appsProvider, _authorization, _environment, _configuration.timezone);
	await CommonCommands.register(appsProvider, _authorization, _environment);
	await ChangesCommands.register(appsProvider, _authorization, _environment);
	registerCommandForLocalDevelopment();

	/**
	 * Registering events
	 */
	vscode.workspace.onWillSaveTextDocument((event) => coreCommands.sourceUpload(event));
	vscode.window.onDidChangeActiveTextEditor((editor) => coreCommands.keepProviders(editor));

	// Online-mode Endpoint schema enrichment (app endpoint names + input suggestions in api.imljson etc.).
	const imljsonSchemaAssociations = new ImljsonSchemaAssociations({
		client,
		authorization: _authorization,
		environment: _environment,
	});
	vscode.window.onDidChangeActiveTextEditor((editor) => imljsonSchemaAssociations.handleActiveEditorChange(editor));
	// Fire-and-forget: never throws, and activation shouldn't block on this API round-trip.
	void imljsonSchemaAssociations.handleActiveEditorChange(vscode.window.activeTextEditor);

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
	sendTelemetry('activated', { version: 2 });

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
