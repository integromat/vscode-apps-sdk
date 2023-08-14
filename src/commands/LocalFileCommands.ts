import * as vscode from 'vscode';
import * as path from 'path';
import { catchError, withProgress } from '../error-handling';
import { log } from '../output-channel';
import { getCurrentEnvironment } from '../providers/configuration';
import { downloadSource, uploadSource } from '../services/get-code';

import { AppComponentType } from '../types/app-component-type.types';
import {
	AppComponentTypesMetadata,
	ComponentCodeFilesMetadata,
	LocalAppOrigin,
	MakecomappJson,
} from '../local-development/types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from '../local-development/consts';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { cloneAppToWorkspace } from '../local-development/clone';


export class LocalFileCommands {
	static register(): void {
		vscode.commands.registerCommand('apps-sdk.file.upload', catchError('Deploy to Make', localFileUpload));

		vscode.commands.registerCommand(
			'apps-sdk.file.download',
			catchError(
				'File download from Make',
				withProgress({ title: 'Updating local file from Make...' }, localFileDownload)
			)
		);

		vscode.commands.registerCommand(
			'apps-sdk.app.clone-to-workspace',
			catchError(
				'Download app to workspace',
				withProgress({ title: 'Downloading app to workspace...' }, cloneAppToWorkspace)
			)
		);
	}
}

/**
 * Uploads the local file defined in makecomapp.json to the Make cloud.
 */
async function localFileUpload(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);
	const makeappRootdir = getMakecomappRootDir(file);
	const stat = await vscode.workspace.fs.stat(file);
	const fileIsDirectory = stat.type === vscode.FileType.Directory;
	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath) + (fileIsDirectory ? '/' : ''); // Relative to makecomapp.json
	const components = findCodesByPath(fileRelativePath, makeappJson, makeappRootdir);

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

/**
 * Rewrites the local file defined in makecomapp.json by version from the Make cloud.
 */
async function localFileDownload(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath); // Relative to makecomapp.json
	const componentDetails = findCodeByFilename(fileRelativePath, makeappJson, makeappRootdir);

	const origin = await askForOrigin(makeappJson.origins);
	if (!origin) {
		return;
	}

	log(
		'debug',
		`Downloading/rewriting ${componentDetails.componentType} ${componentDetails.componentName} in ${file.fsPath} from ${origin.url} app ${origin.appId} version ${origin.appVersion} ...`
	);

	/** @deprecated */
	const environment = getCurrentEnvironment();
	// Download the cloud file version into temp file
	const newTmpFile = vscode.Uri.file(tempFilename(file.fsPath));
	await downloadSource({
		appName: origin.appId,
		appVersion: origin.appVersion,
		appComponentType: componentDetails.componentType,
		appComponentName: componentDetails.componentName,
		codeName: componentDetails.codeName,
		environment,
		destinationPath: newTmpFile,
	});
	// Keep user to approve changes
	const relativeFilepath = path.relative(makeappRootdir.fsPath, file.fsPath);
	await vscode.commands.executeCommand(
		'vscode.diff',
		newTmpFile,
		file,
		`Remote ${origin.label ?? 'Origin'} ↔ ${relativeFilepath}`
	);
	// Delete temp file
	await vscode.workspace.fs.delete(newTmpFile);
}

/**
 * From absolute file path it generates the same one, but with ".tmp" postfix before file extension.
 */
function tempFilename(filename: string): string {
	const parsed = path.parse(filename);
	return path.join(parsed.dir, parsed.name + '.tmp' + parsed.ext);
}

/**
 *
 * @param origins
 * @param purposeLabel If defined, the text is integrated into dialog message as "Choose ... for ${purposeLabel}:"
 * @returns Return undefined, when there are multiple origins, but user cancels the selection dialog.
 */
async function askForOrigin(origins: LocalAppOrigin[], purposeLabel?: string): Promise<LocalAppOrigin | undefined> {
	if (!origins?.length) {
		throw new Error('Missing "origins" in makecomapp.json.');
	}

	if (origins.length === 1) {
		return origins[0];
	}

	const selectedOrigin = await vscode.window.showQuickPick(
		origins.map((origin, index) => {
			const label = origin.label || origin.appId + ' ' + origin.appVersion;
			return <{ origin: LocalAppOrigin } & vscode.QuickPickItem>{
				label,
				description: 'at ' + origin.url,
				picked: index === 0,
				origin: origin,
			};
		}),
		{
			ignoreFocusOut: true,
			title: 'Select the app origin' + (purposeLabel ? `for ${purposeLabel}` : '') + ':',
		}
	);
	return selectedOrigin?.origin;
}


interface CodePath {
	componentType: AppComponentType | 'app';
	componentName: string;
	codeName: string;
	localFile: vscode.Uri;
}

/**
 * Gets app's and component's code, which matches with the local file path.
 */
function findCodeByFilename(
	fileRelativePath: string,
	makecomappJson: MakecomappJson,
	makeappRootdir: vscode.Uri
): CodePath {
	const codes = findCodesByPath(fileRelativePath, makecomappJson, makeappRootdir);
	if (codes.length === 0) {
		throw new Error(`Code file ${fileRelativePath} is not defined in ${MAKECOMAPP_FILENAME}.`);
	}
	if (codes.length > 1) {
		throw new Error(`Multiple files unexpectedly found for ${fileRelativePath}`);
	}
	return codes[0];
}

/**
 * Gets all app's and component's codes, which matches with the local filesystem path or are in subdirectories of this path.
 * @param relativePath - If path is directory, it MUST to end with '/'.
 *                       Else horrible things can happen when some another directory has similar name
 *                       starting with same string as first one.
 * @param limit - Limits the maximum count of results. Used if expected the exact one result only. Default is unlimited.
 */
function findCodesByPath(relativePath: string, makecomappJson: MakecomappJson, makeappRootdir: vscode.Uri): CodePath[] {
	const ret: CodePath[] = [];

	// Try to find in app's direct configuration codes
	for (const [appCodeName, codeFilePath] of Object.entries(makecomappJson.generalCodeFiles)) {
		const codeIsInSubdir = codeFilePath.startsWith(relativePath);
		const codeExactMatch = codeFilePath === relativePath;
		if (codeIsInSubdir || codeExactMatch) {
			const codePath: CodePath = {
				componentType: 'app',
				componentName: '',
				codeName: appCodeName,
				localFile: vscode.Uri.joinPath(makeappRootdir, codeFilePath),
			};
			if (codeExactMatch) {
				// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
				return [codePath];
			}
			ret.push(codePath);
		}
	}

	// Try to find in compoments
	const appComponentsMetadata: AppComponentTypesMetadata = makecomappJson.components;
	/* eslint-disable guard-for-in */
	for (const componentType in appComponentsMetadata) {
		for (const componentName in appComponentsMetadata[componentType as AppComponentType]) {
			const codeFilesMetadata: ComponentCodeFilesMetadata =
				appComponentsMetadata[componentType as AppComponentType][componentName].codeFiles || {};
			for (const codeName in codeFilesMetadata) {
				const codeFilePath = codeFilesMetadata[codeName];
				const codeIsInSubdir = codeFilePath.startsWith(relativePath);
				const codeExactMatch = codeFilePath === relativePath;
				if (codeIsInSubdir || codeExactMatch) {
					const codePath: CodePath = {
						componentType: componentType as AppComponentType,
						componentName,
						codeName,
						localFile: vscode.Uri.joinPath(makeappRootdir, codeFilePath),
					};
					if (codeExactMatch) {
						// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
						return [codePath];
					}
					ret.push(codePath);
				}
			}
		}
	}
	/* eslint-enable guard-for-in */
	return ret;
}
