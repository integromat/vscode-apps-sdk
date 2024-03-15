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
	addComponentIdMapping,
	getComponentRemoteName,
	getLocalIdToRemoteComponentNameMapping,
	getMakecomappJson,
	getMakecomappRootDir,
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
	let makecomappJson = await getMakecomappJson(anyProjectPath);
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
			const allComponentsSummariesInCloud = await getAllRemoteComponentsSummaries(
				anyProjectPath,
				origin,
				'remote',
			);

			// Compare remote component list with local makecomapp.json
			const componentAddingRemoving = await diffComponentsPresence(
				makecomappJson,
				anyProjectPath,
				origin,
				allComponentsSummariesInCloud,
			);
			// New components = new components in makecomapp.json & components to deploy. These components must be created in remote before code deploy.
			const newComponentsToCreate = componentAddingRemoving.localOnly.filter((newComponentInMakecomappjson) =>
				codesToDeploy.find(
					(codeToDeploy) =>
						codeToDeploy.componentType === newComponentInMakecomappjson.componentType &&
						codeToDeploy.componentLocalId === newComponentInMakecomappjson.componentLocalId,
				),
			);

			progresDialogReport('Deploying');

			// Create remote components that has been found in local
			let componentToCreate: (typeof newComponentsToCreate)[0] | undefined;
			while ((componentToCreate = newComponentsToCreate.shift())) {
				const localIdToRemoteComponentnameMapping = getLocalIdToRemoteComponentNameMapping(
					componentToCreate.componentType,
					makecomappJson,
					origin,
				);

				// Create new remote component in origin
				const newComponentName = await createRemoteAppComponent({
					appName: origin.appId,
					appVersion: origin.appVersion,
					...componentToCreate,
					componentName:
						localIdToRemoteComponentnameMapping[componentToCreate.componentLocalId] ??
						componentToCreate.componentLocalId,
					origin,
				});
				// Add new component to idMapping
				await addComponentIdMapping(
					componentToCreate.componentType,
					componentToCreate.componentLocalId,
					newComponentName,
					anyProjectPath,
					origin,
				);
				// Refresh the local representation of makecomapp.json (method addComponentIdMapping() changed the file)
				makecomappJson = await getMakecomappJson(anyProjectPath);
				// Remove the added component also from list `componentAddingRemoving.newComponents`
				componentAddingRemoving.localOnly = componentAddingRemoving.localOnly.filter(
					(component) => component !== componentToCreate,
				);
			}

			/** Deployments errors */
			const errors: { errorMessage: string; codePath: CodePath }[] = [];

			// Deploy codes one-by-one
			for (const component of codesToDeploy) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
				});

				log(
					'debug',
					`Deploying ${component.componentType} ${component.componentLocalId} ${
						component.codeType
					} from ${path.posix.relative(makeappRootdir.path, anyProjectPath.path)}`,
				);

				// Find the remote component name

				// Upload via API
				try {
					await deployComponentCode({
						appComponentType: component.componentType,
						remoteComponentName: getComponentRemoteName(
							component.componentType,
							component.componentLocalId,
							makecomappJson,
							origin,
						),
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
					`Deployed ${component.componentType} ${component.componentLocalId} ${component.codeType} to ${origin.baseUrl} app ${origin.appId} ${origin.appVersion}`,
				);
				// Handle the user "cancel" button press
				if (canceled) {
					break;
				}
			}

			// Display errors
			if (errors.length > 0) {
				showErrorDialog(`Failed ${errors.length} of ${codesToDeploy.length} codes deployments`, {
					modal: true,
					detail: errors
						.map(
							(err) =>
								`** ${err.codePath.componentType} ${err.codePath.componentLocalId} - ${err.codePath.codeType} **\n${err.errorMessage}`,
						)
						.join('\n\n'),
				});
			} else if (codesToDeploy.length >= 2) {
				vscode.window.showInformationMessage(`Sucessfully deployed ${codesToDeploy.length} codes`);
			}
		},
	);
}
