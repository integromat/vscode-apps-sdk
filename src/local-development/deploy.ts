import * as path from 'path';
import * as vscode from 'vscode';
import {
	getMakecomappJson,
	getMakecomappRootDir,
	renameConnectionInMakecomappJson,
} from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { uploadSource } from './code-deploy-download';
import { getAllComponentsSummaries } from './component-summaries';
import { askForOrigin } from './dialog-select-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { diffComponentsPresence } from './diff-components-presence';
import { createRemoteAppComponent } from './create-remote-component';
import { CreateAppComponentPostAction } from './types/create-component-post-action.types';
import { catchError } from '../error-handling';
import { progresDialogReport, withProgressDialog } from '../utils/vscode-progress-dialog';
import { MAKECOMAPP_FILENAME } from './consts';

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
	let fileRelativePath = path.posix.relative(makeappRootdir.path, file.path) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json

	// Special case: If user clicks to `makecomapp.json`, it means "all project files".
	if (fileRelativePath === MAKECOMAPP_FILENAME) {
		fileRelativePath = '/';
	}

	const codesToDeploy = findCodesByFilePath(fileRelativePath, makecomappJson, makeappRootdir);

	if (codesToDeploy.length === 0) {
		throw new Error('Sorry, no associated component code with this file/path found.');
	}

	const origin = await askForOrigin(makecomappJson.origins, makeappRootdir, 'the deployment');
	if (!origin) {
		return;
	}

	await withProgressDialog(
		{ title: `Deploying ${codesToDeploy.length} code${codesToDeploy.length !== 1 ? 's' : ''}`, cancellable: true },
		async (progress, cancellationToken) => {
			let canceled = false;
			cancellationToken.onCancellationRequested(() => {
				canceled = true;
			});

			progresDialogReport('Initial analytics');

			// Get all existing remote components
			const allComponentsSummariesInCloud = await getAllComponentsSummaries(origin);

			// Compare remote component list with local makecomapp.json
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
				newComponentsToCreate.length > 0 ||
				componentAddingRemoving.missingComponents.length > 0
			) {
				// Ask for continue in case of new component(s) found
				progresDialogReport('Waiting for your response');
				const confirmAnswer = await vscode.window.showWarningMessage(
					'Components asymetry found between local files and remote Make',
					{
						modal: true,
						detail: [
							newComponentsToCreate.length > 0
								? `New ${newComponentsToCreate.length} local components\n` +
								  '(will be created at remote Make):\n' +
								  newComponentsToCreate
										.map((newC) => '➕\xA0' + newC.componentType + '\xA0' + newC.componentName)
										.join(', ')
								: '',
							componentAddingRemoving.missingComponents.length > 0
								? `NOTE: Missing ${componentAddingRemoving.missingComponents.length} local components:\n` +
								  '(exists in remote Make, but missing in local project):\n' +
								  componentAddingRemoving.missingComponents
										.map(
											(missingC) =>
												'➖\xA0' + missingC.componentType + '\xA0' + missingC.componentName,
										)
										.join(', ')
								: '',
							'MAKE SURE THIS IS SOMETHING YOU INTEND' +
								(componentAddingRemoving ? ' and there is no typo in some of local component ID' : '') +
								'.',
						].join('\n\n'),
					},
					{ title: 'Continue' },
				);
				if (confirmAnswer?.title !== 'Continue' || canceled) {
					return;
				}
			}

			progresDialogReport('Deploying');

			// Create remote components that has been found in local
			let componentToCreate: typeof newComponentsToCreate[0] | undefined;
			while (componentToCreate = newComponentsToCreate.shift()) {
				// Create new remote component in origin
				const postActions = await createRemoteAppComponent({
					appName: origin.appId,
					appVersion: origin.appVersion,
					...componentToCreate,
					origin,
				});
				// Process post-actions
				for (const postAction of postActions) {
					if (postAction.renameConnection) {
						await renameConnectionInMakecomappJson(
							makeappRootdir,
							postAction.renameConnection.oldId,
							postAction.renameConnection.newId,
						);
					}
				}
				// Remove the added component also from list `componentAddingRemoving.newComponents`
				componentAddingRemoving.newComponents = componentAddingRemoving.newComponents.filter((component) => (
					component !== componentToCreate
				));
			}

			// Deploy codes one-by-one
			for (const component of codesToDeploy) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
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
						`Skipping to deploy ${component.componentType} ${component.componentName} ${component.codeType} because does not exist on Make yet.`,
					);
					continue;
				}

				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentName} ${
						component.codeType
					} from ${path.posix.relative(makeappRootdir.path, file.path)}`,
				);

				// Upload via API
				await uploadSource({
					appComponentType: component.componentType,
					appComponentName: component.componentName,
					codeType: component.codeType,
					origin,
					sourcePath: component.localFile,
				});
				// Log 'done' to console
				log(
					'debug',
					`Deployed ${component.componentType} ${component.componentName} ${component.codeType} to ${origin.baseUrl} app ${origin.appId} ${origin.appVersion}`,
				);
				// Handle the user "cancel" button press
				if (canceled) {
					return;
				}
			}
		},
	);
}
