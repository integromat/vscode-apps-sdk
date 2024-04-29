import * as path from 'node:path';
import * as vscode from 'vscode';
import { deployComponentCode } from './code-pull-deploy';
import { getRemoteComponentsSummary } from './remote-components-summary';
import { askForOrigin } from './ask-origin';
import { findCodesByFilePath } from './find-code-by-filepath';
import { alignComponentsMapping } from './align-components-mapping';
import { MAKECOMAPP_FILENAME } from './consts';
import type { CodeType } from './types/code-type.types';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';
import { deployComponentMetadata } from './deploy-metadata';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { log } from '../output-channel';
import { catchError, showErrorDialog } from '../error-handling';
import { progresDialogReport, withProgressDialog } from '../utils/vscode-progress-dialog';
import { sendTelemetry } from '../extension';
import type { AppComponentType, AppGeneralType } from '../types/app-component-type.types';

export function registerCommands(): void {
	vscode.commands.registerCommand('apps-sdk.local-dev.deploy', catchError('Deploy to Make', bulkDeploy));
}

/**
 * Recursively uploads all local code files under `anyProjectPath` into remote Make.
 *
 * TODO fix order of creation
 *  - `groups` after modules
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
			await alignComponentsMapping(makeappRootdir, origin, remoteComponentsSummary, 'askUser', 'ignore');
			// Load fresh `makecomapp.json` file, because `alignComponentMapping()` changed it.
			makecomappJson = await getMakecomappJson(anyProjectPath);

			progresDialogReport('Deploying');

			/** Deployments errors */
			const errors: {
				errorMessage: string;
				componentType: AppComponentType | AppGeneralType;
				componentLocalId: string;
				codeType?: CodeType;
			}[] = [];

			const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);

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

				sendTelemetry('deploy_component_code', { appComponentType: component.componentType });

				// Find the remote component name
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
					log('error', e.message);
					errors.push({ errorMessage: e.message, ...component });
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

			/*  Deploy the metadata (connection, altConnection, Webhook, label, description,...) to all touched components. */
			/** keys = component unique identificator (for preventing the compoment duplication) */
			const deployedComponents = new Map<string, { componentType: AppComponentType; componentLocalId: string }>();
			// Find all components, whose metadata must be deployed.
			for (const component of codesToDeploy) {
				const componentUniqueID = component.componentType + '-' + component.componentLocalId;
				if (component.componentType !== 'app') {
					deployedComponents.set(componentUniqueID, {
						componentType: component.componentType,
						componentLocalId: component.componentLocalId,
					});
				}
			}
			for (const { componentType, componentLocalId } of deployedComponents.values()) {
				const componentLocalMetadata = makecomappJson.components[componentType][componentLocalId];
				if (componentLocalMetadata === null) {
					continue;
				}
				if (componentLocalMetadata === undefined) {
					throw new Error(
						`Unexpected data error during deploy. Local component metadata of ${componentType} "${componentLocalId}" expected, but not found.`,
					);
				}
				const componentRemoteName = componentIdMapping.getRemoteName(componentType, componentLocalId);
				if (!componentRemoteName) {
					// Component is marked as 'to ignore' in ID mapping.
					continue;
				}

				// TODO Implement the optimalization: Update only if some change detected.
				//   example: const componentRemoteMetadata = remoteComponentsSummary[componentType][componentRemoteName];
				//   example: if (isComponentMetadataChanged(componentType, componentLocalMetadata, componentRemoteMetadata)) { deploy... }

				try {
					await deployComponentMetadata(
						componentType,
						componentLocalId,
						componentLocalMetadata,
						makecomappJson,
						origin,
					);
				} catch (e: any) {
					errors.push({
						errorMessage: `Failed to deploy metadata. ${e.message}`,
						componentType,
						componentLocalId,
					});
				}
			}

			// Display errors
			if (errors.length > 0) {
				showErrorDialog(`Failed ${errors.length} of ${codesToDeploy.length} codes deployments`, {
					modal: true,
					detail: errors
						.map(
							(err) =>
								`** ${err.componentType} "${err.componentLocalId}" - ${
									err.codeType ? ' - ' + err.codeType : ''
								} **\n${err.errorMessage}`,
						)
						.join('\n\n'),
				});
			} else if (codesToDeploy.length >= 2) {
				vscode.window.showInformationMessage(`Successfully deployed ${codesToDeploy.length} codes`);
			}
		},
	);
}
