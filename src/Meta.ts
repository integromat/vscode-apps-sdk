import * as vscode from 'vscode';

/**
 * The version of the currently running VSCode Extension
 */
export const version: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.version;

// Production -> load from file created during the publishing process.
// See `package.json` -> `scripts` for details.
let _isPreReleaseVersion: boolean = false;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	_isPreReleaseVersion = require('./__is-prerelease-version').isPreReleaseVersion;
} catch (e: any) {
	/* ignore */
}

export const isPreReleaseVersion: boolean =
	// - Always `true` in local debug run,
	// - Load from flag file in production.
	vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.isUnderDevelopment || _isPreReleaseVersion;
