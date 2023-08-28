import * as vscode from 'vscode';

/**
 * Finds the file, which is not exists in filesystem.
 * If `basedir/basename` already exists, tries to add a number as postfix until non existing path found.
 *
 * @param basedir
 * @param basename
 * @param initialPostfixNumber If `0`, then postfix will not be added if possible.
 * @returns
 */
export async function getFirstNonExistingPath(basedir: vscode.Uri, basename: string, initialPostfixNumber = 0) {
	let postfix = initialPostfixNumber;
	do {
		const filePath = vscode.Uri.joinPath(basedir, basename + (postfix ? '-' + postfix : ''));
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
