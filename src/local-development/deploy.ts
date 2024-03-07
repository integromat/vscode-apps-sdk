import * as path from 'path';
import * as vscode from 'vscode';
import { deployComponentCode } from './code-pull-deploy';
import { getAllRemoteComponentsSummaries } from './component-summaries';
import { askForOrigin } from './dialog-select-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { diffComponentsPresence } from './diff-components-presence';
import { createRemoteAppComponent } from './create-remote-component';
import { MAKECOMAPP_FILENAME } from './consts';
import { CodePath } from './types/code-path.types';
import {
	getMakecomappJson,
	getMakecomappRootDir,
	renameConnectionInMakecomappJson,
} from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { catchError, errorToString, showErrorDialog } from '../error-handling';
import { progresDialogReport, withProgressDialog } from '../utils/vscode-progress-dialog';

export function registerCommands(): void {
	vscode.commands.registerCommand('apps-sdk.local-dev.deploy', catchError('Deploy to Make', bulkDeploy));
}

/**
 * Recursively uploads all local code files under `anyProjectPath` into remote Make.
 */
async function bulkDeploy(anyProjectPath: vscode.Uri) {
	const makecomappJson = await getMakecomappJson(anyProjectPath);
	const makeappRootdir = getMakecomappRootDir(anyProjectPath);
	const stat = await vscode.workspace.fs.stat(anyProjectPath);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	let fileRelativePath = path.posix.relative(makeappRootdir.path, anyProjectPath.path) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json

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
			const allComponentsSummariesInCloud = await getAllRemoteComponentsSummaries(origin);

			// Compare remote component list with local makecomapp.json
			const componentAddingRemoving = diffComponentsPresence(
				makecomappJson.components,
				allComponentsSummariesInCloud,
			);
			// New components = new components in makecomapp.json & components to deploy. These components must be created in remote before code deploy.
			const newComponentsToCreate = componentAddingRemoving.newComponents.filter((newComponentInMakecomappjson) =>
				codesToDeploy.find(
					(codeToDeploy) =>
						codeToDeploy.componentType === newComponentInMakecomappjson.componentType &&
						codeToDeploy.componentName === newComponentInMakecomappjson.componentName,
				),
			);
			if (newComponentsToCreate.length > 0 || componentAddingRemoving.missingComponents.length > 0) {
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
			let componentToCreate: (typeof newComponentsToCreate)[0] | undefined;
			while ((componentToCreate = newComponentsToCreate.shift())) {
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
				componentAddingRemoving.newComponents = componentAddingRemoving.newComponents.filter(
					(component) => component !== componentToCreate,
				);
			}

			// Skip local components non existing in remote Make
			// Note: In current alghoritm it should not skip anything, because all components has been created in remove above.
			const codesToDeployFinal = codesToDeploy.filter((codePath) => {
				const componentIsMissingInRemote = Boolean(
					componentAddingRemoving.newComponents.find(
						(missingRemoteComponent) =>
							missingRemoteComponent.componentType === codePath.componentType &&
							missingRemoteComponent.componentName === codePath.componentName,
					),
				);
				if (componentIsMissingInRemote) {
					log(
						'debug',
						`Skipping to deploy ${codePath.componentType} ${codePath.componentName} ${codePath.codeType} because does not exist on Make yet.`,
					);
				}
				return !componentIsMissingInRemote;
			});

			/** Deployments errors */
			const errors: { errorMessage: string; codePath: CodePath }[] = [];

			// Deploy codes one-by-one
			for (const component of codesToDeployFinal) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
				});

				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentName} ${
						component.codeType
					} from ${path.posix.relative(makeappRootdir.path, anyProjectPath.path)}`,
				);

				// Upload via API
				try {
					await deployComponentCode({
						appComponentType: component.componentType,
						appComponentName: component.componentName,
						codeType: component.codeType,
						origin,
						sourcePath: component.localFile,
					});
				} catch (e: any) {
					const message = errorToString(e).message;
					log('error', message);
					errors.push({ errorMessage: message, codePath: component });
				}
				// Log 'done' to console
				log(
					'debug',
					`Deployed ${component.componentType} ${component.componentName} ${component.codeType} to ${origin.baseUrl} app ${origin.appId} ${origin.appVersion}`,
				);
				// Handle the user "cancel" button press
				if (canceled) {
					break;
				}
			}

			// Display errors
			if (errors.length > 0) {
				showErrorDialog(`Failed ${errors.length} of ${codesToDeployFinal.length} codes deployments`, {
					modal: true,
					detail: errors
						.map(
							(err) =>
								`** ${err.codePath.componentType} ${err.codePath.componentName} - ${err.codePath.codeType} **\n${err.errorMessage}`,
						)
						.join('\n\n'),
				});
			} else if (codesToDeployFinal.length >= 2) {
				vscode.window.showInformationMessage(`Sucessfully deployed ${codesToDeployFinal.length} codes`)
			}
		},
	);
}
