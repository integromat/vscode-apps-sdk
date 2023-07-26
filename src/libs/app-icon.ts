import path from "path";
import * as asyncfile from "async-file";
import * as download from "image-downloader";
import * as Meta from "../Meta";
import { Environment } from "../types/environment.types";
import Jimp from "jimp";
import { log } from "../output-channel";
import { appsIconTempDir } from "../temp-dir";

/**
 * @returns Icon version. Zero if no icon.
 */
export async function downloadAndStoreAppIcon(
	app: IApp, apiBaseUrl: string, apiAuthorization: string, environment: Environment, isAppOpensource: boolean
): Promise<number> {
	try {
		let iconVersion = 0;
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
async function invertPngAsync(uri: string): Promise<void> {
	// TODO REMOVE DEBUG and TRY/CATCH PARTS. It was there for debug only.
	log('debug', `Inverting icon with URI ${uri} started`);
	let icon: Jimp;
	// TODO This try/catch are here for debug only. Remove them when error resolved.
	try {
		icon = await Jimp.read(uri);
	} catch (err: any) {
		err.message = 'Failed invertPngAsync->Jimp.read(). ' + err.message;
		throw err;
	}
	icon.invert();
	// TODO This try/catch are here for debug only. Remove them when error resolved.
	try {
		await icon.writeAsync(`${uri.slice(0, -4)}.dark.png`);
	} catch (err: any) {
		err.message = 'Failed invertPngAsync->icon.writeAsync(). ' + err.message;
		throw err;
	}
	log('debug', `Inverting icon with URI ${uri} done`);
}


async function generatePublicIcon(uri: string) {
	const icon = await Jimp.read(uri);
	const mask = await Jimp.read(path.join(__dirname, '..','..', 'resources', 'icons', 'masks', 'public.png'));
	icon.blit(mask, 320, 320);
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
