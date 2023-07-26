import path from "path";
import * as asyncfile from "async-file";
import * as download from "image-downloader";
import * as Meta from "../Meta";
import { Environment } from "../types/environment.types";
import Jimp from "jimp";
import { log } from "../output-channel";
import { appsIconTempDir } from "../temp-dir";

/**
 * Downloads PNG icon from Make API and stores it in local temp dir.
 * Also creates the inverted icon and (optionally) public icon.
 * @returns Icon version. Used for icon filemame postfix.
 *          0 = no icon.
 */
export async function downloadAndStoreAppIcon(
	app: IApp, apiBaseUrl: string, apiAuthorization: string, environment: Environment, isAppOpensource: boolean
): Promise<number> {
	try {
		let iconVersion = 0;  // TODO Investigate usage of iconVersion. Remove if not needed.
		let dest: string;
		do {
			iconVersion++;
			dest = path.join(appsIconTempDir, `${app.name}.${iconVersion}.png`);
		} while (await asyncfile.exists(`${dest}.old`));  // TODO Investigate the usage of `.old` files. Remove if not needed.

		if (!await asyncfile.exists(dest)) {
			// Download new icon from API to localdir
			try {
				await download.image({
					headers: {
						"Authorization": apiAuthorization,
						'x-imt-apps-sdk-version': Meta.version
					},
					url: (() => {
						switch (environment.version) {
							case 2:
								return `${apiBaseUrl}/sdk/apps/${app.name}/${app.version}/icon/512`;
							case 1:
							default:
								return `${apiBaseUrl}/app/${app.name}/${app.version}/icon/512`;
						}
					})(),
					dest: dest
				});
			} catch (err: any) {
				// App icon not saved in Make
				return 0; // Version 0 = No icon
			}
		}

		// Invert icon
		try {
			await invertPngAsync(dest);
		} catch (err: any) {
			log('error', `Failed to invert icon with URI ${dest}. Original error: ${err.message}`);
		}

		// Generate public icon
		if (app.public && !isAppOpensource) {
			if (await asyncfile.exists(dest) && !await asyncfile.exists(`${dest.slice(0, -4)}.public.png`)) {
				await generatePublicIcon(dest);
			}
			if (await asyncfile.exists(`${dest.slice(0, -4)}.dark.png`) && !await asyncfile.exists(`${dest.slice(0, -4)}.dark.public.png`)) {
				await generatePublicIcon(`${dest.slice(0, -4)}.dark.png`);
			}
		}

		return iconVersion;
	} catch (err: any) {
		err.message = `Failed to download and store icon for app "${app.name}" with version ${app.version}. ${err.message}`;
		throw err;
	}
}

/**
 * Inverts the colors of a PNG icon.
 *
 * Icon is loaded from the URI (local temp dir)
 * and saved to the same directory ar origin with the updated name by `.dark.png` suffix.
 */
async function invertPngAsync(originalImgUri: string): Promise<void> {
	const icon: Jimp = await Jimp.read(originalImgUri);
	icon.invert();
	await icon.writeAsync(`${originalImgUri.slice(0, -4)}.dark.png`);
}


/**
 * From existing locally stored icon it generates the same one with added small green square in the bottom right corner.
 * new file is stored in the same directory as `{originalFilename}.public.png`.
 */
async function generatePublicIcon(uri: string) {
	// Load original icon
	const icon = await Jimp.read(uri);
	// Load the green square
	const mask = await Jimp.read(path.join(__dirname, '..','..', 'resources', 'icons', 'masks', 'public.png'));
	icon.blit(mask, 320, 320);
	// Save the new file with `.public.png` suffix
	await icon.writeAsync(`${uri.slice(0, -4)}.public.png`);
}

/**
 * Note: Structure is specific for this usage only,
 *       because in each API request there is a specification, what columns are required.
 */
interface IApp {
	name: string;
	label: string;
	description: string;
	version: any;
	beta: any;
	theme: any;
	public: boolean;
	approved: boolean;
	changes: any;
}
