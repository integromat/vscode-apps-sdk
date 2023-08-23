import * as path from 'path';
import * as vscode from 'vscode';
import {
	getMakecomappJson,
	getMakecomappRootDir,
	renameConnection,
	updateMakecomappJson,
} from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { uploadSource } from './code-deploy-download';
import { getAllComponentsSummaries } from './component-summaries';
import { askForOrigin } from './dialog-select-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { diffComponentsPresence } from './diff-components-presence';
import { createAppComponent } from './create-component';
import { CreateAppComponentPostAction } from './types/create-component-post-action.types';
import { catchError } from '../error-handling';


export function registerCommands(): void {
	vscode.commands.registerCommand('apps-sdk.local-dev.deploy', catchError('Deploy to Make', localFileDeploy));
}

/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
async function localFileDeploy(file: vscode.Uri) {
	const makecomappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);
	const stat = await vscode.workspace.fs.stat(file);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json

	const codesToDeploy = findCodesByFilePath(fileRelativePath, makecomappJson, makeappRootdir);

	if (codesToDeploy.length === 0) {
		throw new Error('Sorry, no associated component code with this file/path found.');
	}

	const origin = await askForOrigin(makecomappJson.origins, makeappRootdir, 'deployment to Make');
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

			const allComponentsSummariesInCloud = await getAllComponentsSummaries(origin);
			// Compare cloud component list with local makecomapp.json
			const componentAddingRemoving = diffComponentsPresence(
				makecomappJson.components,
				allComponentsSummariesInCloud,
			);
			// New components = new components in makecomapp.json & components to deploy
			const newComponentsToCreate = componentAddingRemoving.newComponents.filter((newComponentInMakecomappjson) =>
				codesToDeploy.find(
					(codeToDeploy) =>
						codeToDeploy.componentType === newComponentInMakecomappjson.componentType &&
						codeToDeploy.componentName === newComponentInMakecomappjson.componentName,
				),
			);
			if (
				componentAddingRemoving.newComponents.length > 0 ||
				componentAddingRemoving.missingComponents.length > 0
			) {
				// Ask for continue in case of new component(s) found
				const confirmAnswer = await vscode.window.showWarningMessage(
					'Components asymetry found between local files and Make',
					{
						modal: true,
						detail: [
							newComponentsToCreate.length > 0
								? `New ${newComponentsToCreate.length} local components\n` +
								  '(will be created at Make):\n' +
								  newComponentsToCreate
										.map((newC) => '➕\xA0' + newC.componentType + '\xA0' + newC.componentName)
										.join(', ')
								: '',
							componentAddingRemoving.missingComponents.length > 0
								? `NOTE: Missing ${componentAddingRemoving.missingComponents.length} local components:\n` +
								  '(exists in Make, but missing in local project):\n' +
								  componentAddingRemoving.missingComponents
										.map(
											(missingC) =>
												'➖\xA0' + missingC.componentType + '\xA0' + missingC.componentName,
										)
										.join(', ')
								: '',
							'MAKE SURE THIS IS SOMETHING YOU ARE INTENDINT and there is no typo in component ID.',
						].join('\n\n'),
					},
					{ title: 'Continue' },
				);
				if (confirmAnswer?.title !== 'Continue') {
					return;
				}
			}

			// Create new components in cloud
			const postActions: CreateAppComponentPostAction[] = [];
			for (const componentToCreate of newComponentsToCreate) {
				const postActions2 = await createAppComponent({
					appName: origin.appId,
					appVersion: origin.appVersion,
					...componentToCreate,
					origin,
				});
				postActions.push(...postActions2);
			}

			// #region Process all post-actions
			let isMakecomappUpdated = false;
			for (const postAction of postActions) {
				if (postAction.renameConnection) {
					renameConnection(
						makecomappJson,
						postAction.renameConnection.oldId,
						postAction.renameConnection.newId,
					);
					isMakecomappUpdated = true;
				}
			}
			// Write post-action changes back into makecomapp.json file
			if (isMakecomappUpdated) {
				updateMakecomappJson(makeappRootdir, makecomappJson);
			}
			// #endregion Process all post-actions

			// Deploy codes one-by-one
			for (const component of codesToDeploy) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
					message: `${component.componentType} ${component.componentName} ${component.codeName}`,
				});
				// Skip if component removed from cloud
				if (
					componentAddingRemoving.newComponents.find(
						(newComponent) =>
							newComponent.componentType === component.componentType &&
							newComponent.componentName === component.componentName,
					)
				) {
					log(
						'debug',
						`Skipping to deploy ${component.componentType} ${component.componentName} ${component.codeName} because does not exist on Make yet.`,
					);
					continue;
				}

				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentName} ${component.codeName} from ${file.fsPath}`,
				);

				// Upload via API
				await uploadSource({
					appComponentType: component.componentType,
					appComponentName: component.componentName,
					codeName: component.codeName,
					origin,
					sourcePath: component.localFile,
				});
				// Log 'done' to console
				log(
					'debug',
					`Deployed ${component.componentType} ${component.componentName} ${component.codeName} to ${origin.baseUrl} app ${origin.appId} ${origin.appVersion}`,
				);
				// Handle the user "cancel" button press
				if (canceled) {
					return;
				}
			}
		},
	);
}
