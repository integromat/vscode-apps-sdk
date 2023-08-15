import * as path from 'path';
import * as vscode from 'vscode';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { getCurrentEnvironment } from '../providers/configuration';
import { uploadSource } from './code-deploy-download';
import { getAllComponentsSummaries } from './component-summaries';
import { askForOrigin } from './dialog-select-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { diffComponentsPresence } from './diff-components-presence';

/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
export async function localFileDeploy(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);
	const stat = await vscode.workspace.fs.stat(file);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json

	const codesToDeploy = findCodesByFilePath(fileRelativePath, makeappJson, makeappRootdir);

	const environment = getCurrentEnvironment();

	if (codesToDeploy.length === 0) {
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
			title: `Deploying ${codesToDeploy.length} codes to Make`,
		},
		async (progress, cancellationToken) => {
			let canceled = false;
			cancellationToken.onCancellationRequested(() => {
				canceled = true;
			});

			// Compare cloud with local makecomapp.json and find components to add and delete.
			const allComponentSummaryInCloud = await getAllComponentsSummaries(
				origin.appId,
				origin.appVersion,
				environment,
			);
			const componentAddingRemoving = diffComponentsPresence(allComponentSummaryInCloud, makeappJson.components);
			if (componentAddingRemoving.newComponents.length > 0) {
				// Ask for continue in case of new component(s) found
				const confirmAnswer = await vscode.window.showWarningMessage(
					`There are ${
						componentAddingRemoving.newComponents.length > 0
					} new component(s) in your local project. Continue and deploy it as new components to the Make?`,
					{
						modal: true,
						detail:
							'New components: ' +
							componentAddingRemoving.newComponents
								.map((newC) => newC.componentType + ' ' + newC.componentName)
								.join(', '),
					},
					{ title: 'OK' },
					{ title: 'Cancel' },
				);
				if (confirmAnswer?.title !== 'OK') {
					return;
				}
				// Add new components in Make
				// TODO
			}

			for (const component of codesToDeploy) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
					message: `${component.componentType} ${component.componentName} ${component.codeName}`,
				});
				// Log to console
				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentName} ${component.codeName} from ${file.fsPath} to ${origin.url} app ${origin.appId} version ${origin.appVersion}`,
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
					`Deployed ${component.componentType} ${component.componentName} ${component.codeName} to ${origin.url} app ${origin.appId} ${origin.appVersion}`,
				);
				// Handle the user "cancel" button press
				if (canceled) {
					return;
				}
			}
		},
	);
}
