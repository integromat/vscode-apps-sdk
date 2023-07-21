import { join } from "path";
import * as tempy from "tempy";
import * as fs from "fs";
import { log } from "./output-channel";
import * as vscode from "vscode";

const TEMPDIR_PREFIX = "apps-sdk";

/**
 * The path to the local temporary directory where the source code of the SDK is placed during editation.
 *
 * Note: Path is unique for each run of the extension.
 */
export const sourceCodeLocalTempBasedir = join(tempy.directory(), TEMPDIR_PREFIX);


/**
 * Checks if the given file name belongs to the local temporary directory
 * where the source code of this extension is placed during editation.
 *
 * Note: The temp directory is unique for each run of the extension, but user can keep file open during multiple VS Code runs.
 *       It is the reason why we need to check the TEMPDIR_PREFIX, to match also all previous temp directories.
 */
export function isFileBelongingToExtension(fileName: string): boolean {
	const tempdirPrefixTester = new RegExp(`[/\\\\]${TEMPDIR_PREFIX}[/\\\\]`);
	return tempdirPrefixTester.test(fileName);
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
		isFileBelongingToExtension(textDocuments.fileName)
	));
	if (!someAppFileKeptOpen) {
		log('info', 'Cleaning up the source code local temp basedir: ' + sourceCodeLocalTempBasedir);
		fs.rmSync(sourceCodeLocalTempBasedir, {recursive: true});
	}
}
