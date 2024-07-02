import path from 'path';
import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { LocalAppOrigin, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { addEmptyOriginInMakecomappjson, getMakecomappJson } from './makecomappjson';
import { MAKECOMAPP_FILENAME } from './consts';
import { askAddMissingApiKey } from './ask-add-missing-apikey';
import { getCurrentWorkspace } from '../services/workspace';

export const specialAnswers = {
	ADD_ORIGIN: Symbol('Deploy into another app'),
};

/**
 * Displays the selection with list of app origins (for multiple origins defined).
 * If origin is one, nothing asked to user, but instantnly returns this origin.
 *
 * Note: Gets the list of origins from project's makecomapp.json.
 */
export async function askForProjectOrigin(makeappRootdir: vscode.Uri, purposeLabel?: string) {
	const makecomappJson = await getMakecomappJson(makeappRootdir);
	return askForOrigin(makecomappJson.origins, makeappRootdir, purposeLabel);
}

/**
 * Displays the selection with list of app origins (for multiple origins defined).
 * If origin is one one, nothing asked to user, but instantnly returns this origin.
 * @param origins
 * @param makeappRootdir Directory, where makecomapp.json is placed.
 * @param purposeLabel If defined, the text is integrated into dialog message as "Choose ... for ${purposeLabel}:"
 * @returns Return undefined, when there are multiple origins, but user cancels the selection dialog.
 */
export async function askForOrigin(
	origins: LocalAppOrigin[],
	makeappRootdir: vscode.Uri,
	purposeLabel?: string,
	enableFeatureAddNewOrigin: boolean = false,
): Promise<LocalAppOriginWithSecret | undefined> {
	return includeApiKey(
		await askForOrigin2(origins, makeappRootdir, purposeLabel, enableFeatureAddNewOrigin),
		makeappRootdir,
	);
}

async function askForOrigin2(
	origins: LocalAppOrigin[],
	makeappRootdir: vscode.Uri,
	purposeLabel?: string,
	enableFeatureAddNewOrigin: boolean = false,
): Promise<LocalAppOrigin | undefined> {
	if (!Array.isArray(origins)) {
		throw new Error('Origins should be the array.');
	}

	if (origins.length === 0 && !enableFeatureAddNewOrigin) {
		// No existing origin is available and not possible offer the new creation of new one.
		throw new Error(
			'No origin exists. At least one is required, therefore cannot continue. Please, define an origin in "makecomapp.json" first.',
		);
	}

	if (origins.length === 1 && !enableFeatureAddNewOrigin) {
		// Single existing origin is available and not possible offer the new creation of new one.
		// Return the existing origin without asking user.
		return origins[0];
	}

	const quickPickOptions = origins.map((origin, index) => {
		const label = origin.label || origin.appId + ' v' + origin.appVersion;
		let originHost: string;
		try {
			originHost = new URL(origin.baseUrl).host;
		} catch (err: any) {
			err.message = `Invalid baseUrl "${origin.baseUrl}" in origin "${
				origin.label || origin.appId
			}". Need to be fixed in "makecomapp.json"`;
			// TODO: Open the file and put cursor to invalid URL.
			throw err;
		}
		return <{ origin: LocalAppOrigin | symbol } & vscode.QuickPickItem>{
			label,
			description: '(' + (origin.label ? `${origin.appId} ` : '') + 'at ' + originHost + ')',
			picked: index === 0,
			origin: origin,
		};
	});

	if (enableFeatureAddNewOrigin) {
		quickPickOptions.push({
			label: specialAnswers.ADD_ORIGIN.description!,
			description: '(add new remote to origins)',
			origin: specialAnswers.ADD_ORIGIN,
		});
	}

	const selected = await vscode.window.showQuickPick(quickPickOptions, {
		ignoreFocusOut: true,
		title: 'Select the app origin' + (purposeLabel ? ` for ${purposeLabel}` : '') + ':',
	});

	if (typeof selected?.origin === 'symbol') {
		switch (selected.origin) {
			case specialAnswers.ADD_ORIGIN: {
				const newOrigin = await addEmptyOriginInMakecomappjson(makeappRootdir);

				await vscode.commands.executeCommand(
					'vscode.open',
					vscode.Uri.joinPath(makeappRootdir, MAKECOMAPP_FILENAME),
				);
				// Open "makecomapp.json" and highlight the problematic origin
				await vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
				await vscode.commands.executeCommand('editor.actions.findWithArgs', {
					searchString: `"${newOrigin.label}"`,
					isCaseSensitive: true,
				});
				await vscode.commands.executeCommand('editor.action.nextMatchFindAction');

				throw new Error(
					'I have added structure of new origin in "makecomapp.json" file for you. Fill values "-FILL-ME-" and then repeat the required action again.',
				);
			}
			default:
				throw new Error(`Unknown special answer "${selected.description}"`);
		}
	}

	return selected?.origin;
}

/**
 * Takes the origin and return new structure, where apiKey is included.
 */
async function includeApiKey(origin: LocalAppOrigin, makeappRootdir: vscode.Uri): Promise<LocalAppOriginWithSecret>;
async function includeApiKey(origin: undefined, makeappRootdir: vscode.Uri): Promise<undefined>;
async function includeApiKey(
	origin: LocalAppOrigin | undefined,
	makeappRootdir: vscode.Uri,
): Promise<LocalAppOriginWithSecret | undefined>;
async function includeApiKey(
	origin: LocalAppOrigin | undefined,
	makeappRootdir: vscode.Uri,
): Promise<LocalAppOriginWithSecret | undefined> {
	if (!origin) {
		return undefined;
	}
	if (!origin.apikeyFile) {
		throw new Error(
			`Missing the object property "apikeyFile" of origin "${
				origin.label ?? origin.appId ?? 'unnamed'
			} in the file ${MAKECOMAPP_FILENAME}"`,
		);
	}
	const apiKeyUri = vscode.Uri.joinPath(makeappRootdir, origin.apikeyFile);
	try {
		const apiKey = new TextDecoder().decode(await vscode.workspace.fs.readFile(apiKeyUri)).trim();
		return {
			...origin,
			apikey: apiKey,
		};
	} catch (e: any) {
		if (e.code === 'FileNotFound') {
			// Ask user to fill the missing API key
			const apiKey = await askAddMissingApiKey(origin, makeappRootdir);
			return {
				...origin,
				apikey: apiKey,
			};
		} else {
			// Unknown/unexpected error
			const workspaceRoot = getCurrentWorkspace().uri;
			const err = new Error(
				`Cannot read API key file defined in "${MAKECOMAPP_FILENAME}" origin "${
					origin.label ?? origin.appId ?? 'unnamed'
				}". File: "${path.posix.relative(
					workspaceRoot.path,
					vscode.Uri.joinPath(makeappRootdir, origin.apikeyFile).path,
				)}" of current workspace. ${e}`,
			);
			err.name = 'PopupError';
			throw err;
		}
	}
}
