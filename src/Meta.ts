import * as path from 'node:path';
import { readFileSync } from 'node:fs';

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
	version: string;
	isUnderDevelopment?: boolean;
};

/**
 * The version of the currently running VSCode Extension
 */
// export const version: string = vscode.extensions.getExtension('Integromat.apps-sdk')!.packageJSON.version;
export const version: string = packageJson.version;

// Production -> load from file created during the publishing process.
// See `package.json` -> `scripts` for details.
let isPreReleaseBuild = false;
try {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	isPreReleaseBuild = require('./__is-pre-release-build').isPreReleaseBuild;
} catch (_err: any) {
	/* ignore */
}

export const isPreReleaseVersion: boolean =
	// - Always `true` in local debug run,
	// - Load from flag file in production.
	packageJson.isUnderDevelopment || isPreReleaseBuild;
