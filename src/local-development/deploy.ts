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
import type { AppComponentType, AppGeneralType } from '../types/app-component-type.types';
import { sendTelemetry } from '../utils/telemetry';
import { userPreferences } from './helpers/user-preferences';

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

	const origin = await askForOrigin(makecomappJson.origins, makeappRootdir, 'the deployment', true);
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
			const errors: DeploymentError[] = [];

			const componentIdMapping = new ComponentIdMappingHelper(makecomappJson, origin);

			// Deploy codes one-by-one
			for (const componentCode of codesToDeploy) {
				// Update the progress bar
				progress.report({
					increment: 100 / codesToDeploy.length,
				});

				log(
					'debug',
					`Deploying ${componentCode.componentType} ${componentCode.componentLocalId} ${
						componentCode.codeType
					} from ${path.posix.relative(makeappRootdir.path, anyProjectPath.path)}`,
				);

				sendTelemetry('deploy_component_code', { appComponentType: componentCode.componentType });

				// Find the remote component name
				const remoteComponentName = componentIdMapping.getExistingRemoteName(
					componentCode.componentType,
					componentCode.componentLocalId,
				);
				if (remoteComponentName === null) {
					// Mapping explicitely says "ignore this local component"
					continue;
				}

				// Upload via API
				try {
					await deployComponentCode({
						appComponentType: componentCode.componentType,
						remoteComponentName: remoteComponentName,
						codeType: componentCode.codeType,
						origin,
						sourcePath: componentCode.localFile,
					});
				} catch (e: any) {
					log('error', e.message);
					errors.push({ errorMessage: e.message, ...componentCode });
				}
				// Log 'done' to console
				log(
					'debug',
					`Deployed ${componentCode.componentType} ${componentCode.componentLocalId} ${componentCode.codeType} to ${origin.baseUrl} app ${origin.appId} ${origin.appVersion}`,
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

			// #region IML Function's "Access denied" error handling (because IML function deployment is temporarily disabled for external users)
			const imlFunctionsDeploymentErrors = [];
			const otherErrors = [];
			for (const err of errors) {
				if (err.componentType === 'function' && err.errorMessage.includes('Access denied')) {
					imlFunctionsDeploymentErrors.push(err);
				} else {
					// Store other errors, which will be handled and displayed to user by code below.
					otherErrors.push(err);
				}
			}
			if (
				imlFunctionsDeploymentErrors.length > 0 &&
				userPreferences.get('ignoreImlFunctionAccesDeniedError') !== true
			) {
				const response = await vscode.window.showErrorMessage(
					`Access denied to deploy IML functions`,
					{
						modal: true,
						detail: `Rejected the deployment of ${imlFunctionsDeploymentErrors.length} IML function(s) because you have no permission to deploy these codes directly. We apologize for inconveniences, but standard write access has been temporary disabled. You need to submit form https://tally.so/r/3Ell6B for update your IML functions.`,
					},
					{ title: "Don't show again until VSCode restart" }, // Alternatives: "Hide" / "Ignore" / "Mute"
					{ title: 'Close', isCloseAffordance: true },
				);
				if (response?.title === "Don't show again until VSCode restart") {
					userPreferences.set('ignoreImlFunctionAccesDeniedError', true);
				}
			}
			// #endregion IML Function's "Access denied" error handling

			// Display errors
			if (otherErrors.length > 0) {
				// Log errors
				log('error', `Deployment finished with ${otherErrors.length} errors:`);
				for (const err of otherErrors) {
					log('error', ' - ' + deploymentErrorToString(err, false));
				}

				// Display the modal error dialog
				const MAX_DISPLAYED_ERRORS = 4;
				showErrorDialog(
					`Failed ${otherErrors.length} of ${
						codesToDeploy.length - imlFunctionsDeploymentErrors.length
					} codes deployments`,
					{
						modal: true,
						detail:
							// Display first X errors
							otherErrors
								.filter((_value, index) => index < MAX_DISPLAYED_ERRORS)
								.map((deploymentError) => deploymentErrorToString(deploymentError, true))
								.join('\n\n') +
							// + info "and Y other errors"
							(otherErrors.length > MAX_DISPLAYED_ERRORS
								? `\n\n ... and ${otherErrors.length - MAX_DISPLAYED_ERRORS} other errors.`
								: ''),
					},
				);
			} else {
				// No errors. Show successful dialog.
				const sucessfullyDeployedCount = codesToDeploy.length - imlFunctionsDeploymentErrors.length;
				if (sucessfullyDeployedCount > 0) {
					vscode.window.showInformationMessage(
						`Successfully deployed ${sucessfullyDeployedCount} ${
							sucessfullyDeployedCount === 1 ? 'code' : 'codes'
						}.`,
					);
				} else {
					vscode.window.showInformationMessage('Nothing deployed.');
				}
			}
		},
	);
}

function deploymentErrorToString(err: DeploymentError, multiline: boolean): string {
	const header =
		(err.componentType === 'app' ? 'Generic' : err.componentType + '"' + err.componentLocalId + '"') +
		`: ${err.codeType ? ' - ' + err.codeType : ''}`;

	if (multiline) {
		return `** ${header} **\n${err.errorMessage}`;
	} else {
		return `Error in ${header}: ${err.errorMessage}`;
	}
}

interface DeploymentError {
	errorMessage: string;
	componentType: AppComponentType | AppGeneralType;
	componentLocalId: string;
	codeType?: CodeType;
}
