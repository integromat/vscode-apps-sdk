import * as vscode from 'vscode';
import * as path from 'path';
import { catchError, withProgress } from '../error-handling';
import { log } from '../output-channel';
import { downloadSource } from '../local-development/code-deploy-download';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { findCodeByFilePath } from '../local-development/find-code-by-filepath';
import { askForOrigin } from '../local-development/dialog-select-origin';

export function registerCommands(): void {
	vscode.commands.registerCommand(
		'apps-sdk.local-dev.file-download',
		catchError(
			'File download from Make',
			withProgress({ title: 'Updating local file from Make...' }, localFileDownload)
		)
	);
}

/**
 * Rewrites the local file defined in makecomapp.json by version from the Make cloud.
 */
async function localFileDownload(file: vscode.Uri) {
	const makeappJson = await getMakecomappJson(file);

	const makeappRootdir = getMakecomappRootDir(file);

	const fileRelativePath = path.relative(makeappRootdir.fsPath, file.fsPath); // Relative to makecomapp.json
	const componentDetails = findCodeByFilePath(fileRelativePath, makeappJson, makeappRootdir);

	const origin = await askForOrigin(makeappJson.origins, makeappRootdir, 'app cloning to local');
	if (!origin) {
		return;
	}

	log(
		'debug',
		`Downloading/rewriting ${componentDetails.componentType} ${componentDetails.componentName} in ${file.fsPath} from ${origin.baseUrl} app ${origin.appId} version ${origin.appVersion} ...`
	);

	// Download the cloud file version into temp file
	const newTmpFile = vscode.Uri.file(tempFilename(file.fsPath));
	await downloadSource({
		appComponentType: componentDetails.componentType,
		appComponentName: componentDetails.componentName,
		codeName: componentDetails.codeName,
		origin,
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
