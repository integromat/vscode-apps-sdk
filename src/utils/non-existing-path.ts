import type * as IVscode from 'vscode';
import { vscodeLibWrapperFactory } from '../services/vscode-lib-wraper';

const vscode = vscodeLibWrapperFactory.lib;

/**
 * Finds the file, which does not exist in filesystem.
 * If `basedir/basename` already exists, tries to add a number as postfix until non existing path found.
 */
export async function getFirstNonExistingPath(basedir: IVscode.Uri, basename: string) {
	let postfix = 1; // Note: '1' will not be added as postfix (1 == without postfix)
	do {
		const filePath = vscode.Uri.joinPath(basedir, basename + (postfix > 1 ? postfix : ''));
		try {
			await vscode.workspace.fs.stat(filePath);
		} catch (e: any) {
			if (e.code === 'FileNotFound') {
				// This is the right place for new apikey
				return filePath;
			}
			throw e; // Unknown error
		}
		postfix++;
	} while (postfix < 100);
	throw new Error(`Path (basename '${basename}') postfix finding exceeded the maximum iterations count.`);
}
