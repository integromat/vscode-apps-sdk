import { join } from "path";
import * as tempy from "tempy";
import * as fs from "fs";
import { log } from "./output-channel";

/**
 * The path to the local temporary directory where the source code of the SDK is placed during editation.
 *
 * Note: Path is unique for each run of the extension.
 */
export const sourceCodeLocalTempBasedir = join(tempy.directory(), "apps-sdk");

/**
 * Remove the local temporary directory from disk.
 */
export function rmCodeLocalTempBasedir() {
	if (!sourceCodeLocalTempBasedir.includes("apps-sdk")) {
		// Make sure, that the subdir is defined correctly (to prevent accidental deletion of another data on disk)
		throw new Error('Unexpected sourceCodeLocalTempBasedir value: ' + sourceCodeLocalTempBasedir);
	}
	log('info', 'Cleaning up the source code local temp basedir: ' + sourceCodeLocalTempBasedir);
	// Delete dir "dir" recurisively
	fs.rmSync(sourceCodeLocalTempBasedir, {recursive: true});
}
