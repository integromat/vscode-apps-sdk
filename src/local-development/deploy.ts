import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../output-channel';
import { getCurrentEnvironment } from '../providers/configuration';
import { uploadSource } from './code-deploy-download';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { findCodesByFilePath } from './find-code-by-filepath';
import { askForOrigin } from './dialog-select-origin';

/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
export async function localFileDeploy(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);
	const stat = await vscode.workspace.fs.stat(file);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json
	const components = findCodesByFilePath(fileRelativePath, makeappJson, makeappRootdir);

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

			for (const component of components) {
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
