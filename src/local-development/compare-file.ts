import * as vscode from 'vscode';
import * as path from 'path';
import { catchError } from '../error-handling';
import { log } from '../output-channel';
import { pullComponentCode } from './code-pull-deploy';
import { getComponentRemoteName, getMakecomappJson, getMakecomappRootDir, getRemoteComponentNameToLocalIdMapping } from './makecomappjson';
import { findCodeByFilePath } from './find-code-by-filepath';
import { askForOrigin } from './dialog-select-origin';
import { withProgressDialog } from '../utils/vscode-progress-dialog';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.file-compare',
		catchError('Compare with Make', localFileCompare),
	);
}

/**
 * Pulls the file from Make and shows the comparision with the local file.
 */
async function localFileCompare(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.posix.relative(makeappRootdir.path, file.path); // Relative to makecomapp.json
	const componentDetails = findCodeByFilePath(fileRelativePath, makeappJson, makeappRootdir);

	const origin = await askForOrigin(makeappJson.origins, makeappRootdir, 'app cloning to local');
	if (!origin) {
		return;
	}

	const remoteComponentName = getComponentRemoteName(
		componentDetails.componentType,
		componentDetails.componentLocalId,
		makeappJson,
		origin,
	);

	log(
		'debug',
		`Pulling ${componentDetails.componentType} ${componentDetails.componentLocalId} in file ${path.posix.relative(
			makeappRootdir.path,
			file.path,
		)} from ${origin.baseUrl} app ${origin.appId} version ${origin.appVersion} ...`,
	);

	// Download the cloud file version into temp file
	const newTmpFile = tempFilename(file);

	await withProgressDialog({ title: '' }, async (_progress, _cancellationToken) => {
		await pullComponentCode({
			appComponentType: componentDetails.componentType,
			remoteComponentName: remoteComponentName,
			codeType: componentDetails.codeType,
			origin,
			destinationPath: newTmpFile,
		});
	});

	// Keep user to approve changes
	const relativeFilepath = path.posix.relative(makeappRootdir.path, file.path);
	await vscode.commands.executeCommand(
		'vscode.diff',
		newTmpFile,
		file,
		`Remote ${origin.label ?? 'Origin'} ↔ ${relativeFilepath}`,
	);
	// Delete temp file
	await vscode.workspace.fs.delete(newTmpFile);
}

/**
 * From absolute file path it generates the same one, but with ".tmp" postfix before file extension.
 */
function tempFilename(filename: vscode.Uri): vscode.Uri {
	const parsed = path.parse(filename.fsPath);
	const uri = vscode.Uri.joinPath(filename, '..', '_temp-remote.' + parsed.name + parsed.ext);
	return uri;
}
