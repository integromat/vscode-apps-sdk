import throat from 'throat';
import * as vscode from 'vscode';
import { APIKEY_DIRNAME } from './consts';
import { getCurrentWorkspace } from '../services/workspace';
import { getFirstNonExistingPath } from '../utils/non-existing-path';

const limitConcurrency = throat(1);

/**
 * Stores a secret into new local file into `/.secrets/secretName-[postfixNubmber]` file.
 * @returns Uri of new apikey file.
 */
export async function storeSecret(secretName: string, secret: string): Promise<vscode.Uri> {
	return limitConcurrency(async () => {
		const workspaceRoot = getCurrentWorkspace().uri;
		const apikeyDir = vscode.Uri.joinPath(workspaceRoot, APIKEY_DIRNAME);
		const apikeyPath = await getFirstNonExistingPath(apikeyDir, secretName, 1);

		await vscode.workspace.fs.writeFile(apikeyPath, new TextEncoder().encode(secret));

		return apikeyPath;
	});
}
