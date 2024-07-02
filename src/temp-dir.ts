import * as fs from 'fs';
import { join } from 'path';
import * as tempy from 'tempy';
import * as vscode from 'vscode';
import { log } from './output-channel';

const TEMPDIR_PREFIX = 'apps-sdk';

/**
 * The path to the local Extesion temporary directory where the source code + icons of Custom Apps
 * are placed during editation.
 *
 * Note: Path is unique for each run of the extension.
 */
export const sourceCodeLocalTempBasedir = join(tempy.directory(), TEMPDIR_PREFIX);

/**
 * Temporary directory, where are icons of Custom Apps placed (cached).
 */
export const appsIconTempDir = join(sourceCodeLocalTempBasedir, 'icons');

fs.mkdirSync(sourceCodeLocalTempBasedir, { recursive: true });
fs.mkdirSync(appsIconTempDir, { recursive: true });

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
	if (!sourceCodeLocalTempBasedir.includes('apps-sdk')) {
		// Make sure, that the subdir is defined correctly (to prevent accidental deletion of another data on disk)
		throw new Error('Unexpected sourceCodeLocalTempBasedir value: ' + sourceCodeLocalTempBasedir);
	}

	// Clean up the source code local temp basedir if nothing kept open
	const someAppFileKeptOpen = vscode.workspace.textDocuments.some((textDocuments) =>
		isFileBelongingToExtension(textDocuments.fileName),
	);
	if (!someAppFileKeptOpen) {
		// Full tempdir cleanup
		log('info', 'Cleaning up the source code local temp basedir: ' + sourceCodeLocalTempBasedir);
		fs.rmSync(sourceCodeLocalTempBasedir, { recursive: true });
	} else {
		// Some file kept open, do not delete the whole temp dir.
		// Partial tempdir cleanup only: Delete subdir with icons only.
		log('info', 'Cleaning up the local temp icon dir: ' + appsIconTempDir);
		fs.rmSync(appsIconTempDir, { recursive: true });
	}
}
