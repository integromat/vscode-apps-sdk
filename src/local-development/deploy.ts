import * as path from 'node:path';
import * as vscode from 'vscode';
import { deployComponentCode } from './code-pull-deploy';
import { getRemoteComponentsSummary } from './remote-components-summary';
import { askForOrigin } from './ask-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { alignComponentsMapping } from './align-components-mapping';
import { MAKECOMAPP_FILENAME } from './consts';
import { CodePath } from './types/code-path.types';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { catchError, errorToString, showErrorDialog } from '../error-handling';
import { progresDialogReport, withProgressDialog } from '../utils/vscode-progress-dialog';

export function registerCommands(): void {
	vscode.commands.registerCommand('apps-sdk.local-dev.deploy', catchError('Deploy to Make', bulkDeploy));
}

/**
 * Recursively uploads all local code files under `anyProjectPath` into remote Make.
 *
 * TODO fix order of creation
 *  - `groups` after modules
 *  - `modules` after webhooks
 *  - Resolve issue in API: If multiple components created in short time, it can miss on backend sometimes.
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
			const remoteComponentsSummary = await getRemoteComponentsSummary(anyProjectPath, origin);

			// Compare all local components with remote. If local is not paired, link it or create new component or ignore component.
			await alignComponentsMapping(
				makecomappJson,
				makeappRootdir,
				origin,
				remoteComponentsSummary,
				'askUser',
				'ignore',
			);
			// Load fresh `makecomapp.json` file, because `alignComponentMapping()` changed it.
			makecomappJson = await getMakecomappJson(anyProjectPath);

			progresDialogReport('Deploying');

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
				const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);
				const remoteComponentName = componentIdMapping.getExistingRemoteName(
					component.componentType,
					component.componentLocalId,
				);
				if (remoteComponentName === null) {
					// Mapping explicitely says "ignore this local component"
					continue;
				}

				// Upload via API
				try {
					await deployComponentCode({
						appComponentType: component.componentType,
						remoteComponentName: remoteComponentName,
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

			// TODO Implement: Deploy the metadata (connection, altConnection, Webhook, label, description,...) to all touched components.

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
				vscode.window.showInformationMessage(`Successfully deployed ${codesToDeploy.length} codes`);
			}
		},
	);
}
