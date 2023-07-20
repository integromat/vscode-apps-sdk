import path from "path";
import * as asyncfile from "async-file";
import * as download from "image-downloader";
import * as Meta from "../Meta";
import { Environment } from "../types/environment.types";
import { showError } from "../error-handling";
import Jimp from "jimp";
import App from "../tree/App";
import { log } from "../output-channel";

/**
 * @returns Icon version. Zero if no icon.
 */
export async function downloadAndStoreAppIcon(
	app: IApp, iconDir: string, apiBaseUrl: string, apiAuthorization: string, environment: Environment, isAppOpensource: boolean
): Promise<number> {
	try {
		let iconVersion = 1;
		let dest = path.join(iconDir, `${app.name}.${iconVersion}.png`);
		// Backup old icon
		while (await asyncfile.exists(`${dest}.old`)) {
			iconVersion++;
			dest = path.join(iconDir, `${app.name}.${iconVersion}.png`);
		}

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
			const success = await invertPngAsync(dest);
		} catch (err: any) {
			log('warn', `Failed to invert icon with URI ${dest}. Original error: ${err.message}`);
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
	const icon = await Jimp.read(uri);
	icon.invert();
	await icon.writeAsync(`${uri.slice(0, -4)}.dark.png`);
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
