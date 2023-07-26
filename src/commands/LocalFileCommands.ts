import * as vscode from 'vscode';
import { catchError, showError } from '../error-handling';
import AppsProvider from '../providers/AppsProvider';
import { Environment } from '../types/environment.types';
import { log } from '../output-channel';
import App from '../tree/App';
import { getCurrentEnvironment } from '../providers/configuration';
import { downloadSource } from '../services/get-code';
import { ModuleComponentSummary, getAppComponents } from '../services/get-app-components';

export class LocalFileCommands {

	static register(
		appsProvider: AppsProvider,
		_authorization: string,
		_environment: Environment
	): void {

		vscode.commands.registerCommand('apps-sdk.file.upload', async function (context) {
			log('debug', 'Upload context: ' + JSON.stringify(context, null, 2));
			showError('Sorry, not implemented', 'apps-sdk.file.upload');
		});

		vscode.commands.registerCommand('apps-sdk.file.download', async function (context) {
			log('debug', 'Download context:' + JSON.stringify(context, null, 2));
			showError('Sorry, not implemented', 'apps-sdk.file.download');
		});

		// Success UI message
		vscode.commands.registerCommand('apps-sdk.app.download-to-workspace', catchError('Download app to workspace', downloadAppToWorkspace));
	}
}


async function downloadAppToWorkspace(context: App): Promise<void> {
	const appName = context.name;
	const appVersion = context.version;

	if (!vscode.workspace.workspaceFolders) {
		throw new Error('No workspace opened');
	}
	if (vscode.workspace.workspaceFolders.length > 1) {
		throw new Error('More than one workspace opened. Cannot decide, where to download app.');
	}

	const workspace = vscode.workspace.workspaceFolders[0];

	const wroot = workspace.uri;

	// const configuration = getConfiguration();
	const environment = getCurrentEnvironment();

	const srcDir = vscode.Uri.joinPath(wroot, 'src');

	// Component types are: functions, rpcs, modules, connections, webhooks, (apps)

	const modules = await getAppComponents<ModuleComponentSummary>('modules', appName, appVersion, environment);

	// Common
	vscode.workspace.fs.createDirectory(srcDir);
	// const baseLocalPath = vscode.Uri.joinPath(srcDir, 'base.imljson');
	// await downloadSource(appName, appVersion, 'app', '', 'api', environment, baseLocalPath.fsPath);
	const commonLocalPath = vscode.Uri.joinPath(srcDir, 'common.json');
	await downloadSource(appName, appVersion, 'app', '', 'common', environment, commonLocalPath.fsPath);


	for (const module of modules) {
		// create module directory
		const modulesDir = vscode.Uri.joinPath(srcDir, 'modules');
		vscode.workspace.fs.createDirectory(modulesDir);
		// save codes into .imljson files
		for(const codeName of ['api', 'parameters', 'expect', 'interface', 'samples', 'scope']) {
			const destinationPath = vscode.Uri.joinPath(modulesDir, module.name, codeName + '.imljson');
			await downloadSource(appName, appVersion, 'modules', module.name, codeName, environment, destinationPath.fsPath);
		}
	}

	// Load app list
	// const appList: AppsListItem[] = (await Core.rpGet(`https://${environment.url}/v2/sdk/apps`, 'Token ' + environment.apikey, {
	// 	'cols[]': [
	// 		'name', 'label', 'description', 'version', 'beta', 'theme', 'public', 'approved', 'changes'
	// 	]
	// })).apps;
	// await fs.writeFile(join(modulesDir.fsPath, '.apps.json'), JSON.stringify(appList, null, 2));

	// Load module list

	vscode.window.showInformationMessage(`Downloaded to local workspace into "/src".`);
}
