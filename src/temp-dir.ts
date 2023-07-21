import { join } from "path";
import * as tempy from "tempy";
import * as fs from "fs";
import { log } from "./output-channel";
import * as vscode from "vscode";

/**
 * The path to the local Extesion temporary directory where the source code + icons of SDK apps
 * are placed during editation.
 *
 * Note: Path is unique for each run of the extension.
 */
export const tempRootdir = join(tempy.directory(), "apps-sdk");

/**
 * Temporary directory, where are icons of SDK apps placed (cached).
 */
export const appsIconTempDir = join(tempRootdir, "icons");

fs.mkdirSync(tempRootdir, { recursive: true });
fs.mkdirSync(appsIconTempDir, { recursive: true });

/**
 * Checks if the given file name belongs to the local temporary directory
 * where the source code of this extension is placed during editation.
 */
export function isFileBelongingToExtension(fileName: string): boolean {
	return fileName.includes(tempRootdir);
}


/**
 * Remove the local temporary directory from disk.
 */
export function rmCodeLocalTempBasedir() {
	if (!tempRootdir.includes("apps-sdk")) {
		// Make sure, that the subdir is defined correctly (to prevent accidental deletion of another data on disk)
		throw new Error('Unexpected sourceCodeLocalTempBasedir value: ' + tempRootdir);
	}

	// Clean up the source code local temp basedir if nothing kept open
	const someAppFileKeptOpen = vscode.workspace.textDocuments.some((textDocuments) => (
		isFileBelongingToExtension(textDocuments.fileName)
	));
	if (!someAppFileKeptOpen) {
		log('info', 'Cleaning up the source code local temp basedir: ' + tempRootdir);
		fs.rmSync(tempRootdir, {recursive: true});
	}
}
