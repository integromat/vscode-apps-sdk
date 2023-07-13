import { join } from "path";
import * as tempy from "tempy";
import * as fs from "fs";
import { log } from "./output-channel";
import * as vscode from "vscode";


/**
 * The path to the local temporary directory where the source code of the SDK is placed during editation.
 *
 * Note: Path is unique for each run of the extension.
 */
export const sourceCodeLocalTempBasedir = join(tempy.directory(), "apps-sdk");


/**
 * Checks if the given file name belongs to the local temporary directory
 * where the source code of this extension is placed during editation.
 */
export function isFileBelongsToExtension(fileName: string): boolean {
	return fileName.includes(sourceCodeLocalTempBasedir);
}


/**
 * Remove the local temporary directory from disk.
 */
export function rmCodeLocalTempBasedir() {
	if (!sourceCodeLocalTempBasedir.includes("apps-sdk")) {
		// Make sure, that the subdir is defined correctly (to prevent accidental deletion of another data on disk)
		throw new Error('Unexpected sourceCodeLocalTempBasedir value: ' + sourceCodeLocalTempBasedir);
	}

	// Clean up the source code local temp basedir if nothing kept open
	const someAppFileKeptOpen = vscode.workspace.textDocuments.some((textDocuments) => (
		isFileBelongsToExtension(textDocuments.fileName)
	));
	if (!someAppFileKeptOpen) {
		log('info', 'Cleaning up the source code local temp basedir: ' + sourceCodeLocalTempBasedir);
		fs.rmSync(sourceCodeLocalTempBasedir, {recursive: true});
	}
}
