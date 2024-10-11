import * as path from 'node:path';
import { existsSync } from 'node:fs';
import * as download from 'image-downloader';
import { Jimp } from 'jimp';
import * as Meta from '../Meta';
import { Environment } from '../types/environment.types';
import { log } from '../output-channel';
import { appsIconTempDir } from '../temp-dir';

/**
 * Downloads PNG icon from Make API and stores it in local temp dir.
 * Also creates the inverted icon and (optionally) public icon.
 * @returns Icon version. Used for icon filemame postfix.
 *          0 = no icon.
 */
export async function downloadAndStoreAppIcon(
	app: IApp,
	apiBaseUrl: string,
	apiAuthorization: string,
	environment: Environment,
	_isAppOpensource: boolean,
): Promise<number> {
	try {
		let iconVersion = 0; // TODO Investigate usage of iconVersion. Remove if not needed.
		let iconLocalPath: ReturnType<typeof getIconLocalPath>;
		do {
			iconVersion++;
			iconLocalPath = getIconLocalPath(app.name, app.version, iconVersion, false);
		} while (existsSync(`${iconLocalPath.dark}.old`)); // TODO Investigate the usage of `.old` files. Remove if not needed.

		if (!existsSync(iconLocalPath.dark)) {
			// Download new icon from API to localdir
			// TODO Do not wait for icon download. Load the tree without icons and download on the background.
			try {
				await download.image({
					headers: {
						Authorization: apiAuthorization,
						'imt-apps-sdk-version': Meta.version,
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
					dest: iconLocalPath.dark,
				});
			} catch (_err: any) {
				// App icon not saved in Make
				return 0; // Version 0 = No icon
			}

			await generateAlternativeIcons(iconLocalPath, getIconLocalPath(app.name, app.version, iconVersion, true));
		}

		return iconVersion;
	} catch (err: any) {
		err.message = `Failed to download and store icon for app "${app.name}" with version ${app.version}. ${err.message}`;
		throw err;
	}
}

/**
 * From original dark-mode icon, it generates the same one with:
 *  - light-mode icon (inverted colors)
 *  - public icon (icon with green square in the bottom right corner)
 *  - public light-mode icon (inverted colors + green square in the bottom right corner)
 *
 * Note: Weird type `${string}.${string}` in `publicIconLocalPath` is defined here
 *       because Jimp 1.x needs this weird type as input parameter.
 *       Opened bug report for the fix: https://github.com/jimp-dev/jimp/issues/1349

 */
export async function generateAlternativeIcons(
	iconLocalPath: { dark: `${string}.${string}`; light: `${string}.${string}` },
	publicIconLocalPath: { dark: `${string}.${string}`; light: `${string}.${string}` },
) {
	if (!existsSync(iconLocalPath.dark)) {
		throw new Error(`Icon file ${iconLocalPath.dark} alternatives cannot be generated. File does not exist.`);
	}
	// Generate public dark-mode icon
	await generatePublicIcon(iconLocalPath.dark, publicIconLocalPath.dark);
	// Generate light-mode icon (Inverted icon)
	try {
		await invertPngAsync(iconLocalPath.dark, iconLocalPath.light);
	} catch (err: any) {
		log('error', `Failed to invert icon file ${iconLocalPath.dark}. Original error: ${err.message}`);
		return;
	}
	// Generate public light-mode icon
	await generatePublicIcon(iconLocalPath.light, publicIconLocalPath.light);
}

/**
 * Inverts the colors of a PNG icon.
 *
 * Icon is loaded from the source, inverted, and saved to the to the destination.
 */
async function invertPngAsync(sourceImgPath: string, destinationImgPath: `${string}.${string}`): Promise<void> {
	const icon = await Jimp.read(sourceImgPath);
	icon.invert();
	await icon.write(destinationImgPath);
}

/**
 * Gets path to app icon file placed in local temp dir.
 * Note: Not in the scope to download the icon or care if file exists.
 * @param appName ID of the app.
 * @param appVersion Version of the app.
 * @param iconVersion Version of the icon.
 * @param publicIcon If true, returns path to icon with a public sign. Note: Default icon is the dark non-public one.
 * @returns Paths to icon files.
 *
 *          Note: Weird returning type `${string}.${string}` is defined here
 *                because Jimp 1.x needs this weird type as input parameter.
 */
export function getIconLocalPath(appName: string, appVersion: number, iconVersion: number, publicIcon?: boolean) {
	return {
		// Default icon. It is the icon for dark theme.
		// Note: Dark is the default icon data source. All other icons are edited clone of this dark original.
		dark: path.join(
			appsIconTempDir,
			`${appName}.${appVersion}.${iconVersion}${publicIcon ? '.public' : ''}.png`,
		) as `${string}.${string}`,
		// Icon for light theme.
		light: path.join(
			appsIconTempDir,
			`${appName}.${appVersion}.${iconVersion}.lightmode${publicIcon ? '.public' : ''}.png`,
		) as `${string}.${string}`,
	};
}

/**
 * From existing locally stored icon file
 * it generates the same one with added small green square in the bottom right corner.
 */
async function generatePublicIcon(sourceImgPath: string, destinationImgPath: `${string}.${string}`) {
	// Load original icon
	const icon = await Jimp.read(sourceImgPath);
	// Load the green square
	const mask = await Jimp.read(path.join(__dirname, '..', '..', 'resources', 'icons', 'masks', 'public.png'));
	icon.blit({ src: mask, x: 320, y: 320 });
	// Save the new file with `.public.png` suffix
	await icon.write(destinationImgPath);
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
