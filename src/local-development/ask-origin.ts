import path from 'path';
import * as vscode from 'vscode';
import { LocalAppOrigin, LocalAppOriginWithSecret } from './types/makecomapp.types';
import { TextDecoder } from 'util';
import { getMakecomappJson } from './makecomappjson';
import { MAKECOMAPP_FILENAME } from './consts';
import { getCurrentWorkspace } from '../services/workspace';

/**
 * Uses VS Code API to display the selection with list of app origins (for multiple origins defined).
 * If origin is one one, nothing asked to user, but instantnly returns this origin.
 *
 * Note: Gets the list of origins from project's makecomapp.json.
 */
export async function askForProjectOrigin(makeappRootdir: vscode.Uri, purposeLabel?: string) {
	const makecomappJson = await getMakecomappJson(makeappRootdir);
	return askForOrigin(makecomappJson.origins, makeappRootdir, purposeLabel);
}

/**
 * Uses VS Code API to display the selection with list of app origins (for multiple origins defined).
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
): Promise<LocalAppOriginWithSecret | undefined> {
	return includeApiKey(await askForOrigin2(origins, purposeLabel), makeappRootdir);
}

async function askForOrigin2(origins: LocalAppOrigin[], purposeLabel?: string): Promise<LocalAppOrigin | undefined> {
	if (!Array.isArray(origins)) {
		throw new Error('Origins should be the array.');
	}

	if (origins.length === 0) {
		return undefined;
	}

	if (origins.length === 1) {
		return origins[0];
	}

	const selected = await vscode.window.showQuickPick(
		origins.map((origin, index) => {
			const label = origin.label || origin.appId + ' v' + origin.appVersion;
			const originHost = new URL(origin.baseUrl).host;
			return <{ origin: LocalAppOrigin } & vscode.QuickPickItem>{
				label,
				description: '(' + (origin.label ? `${origin.appId} ` : '') + 'at ' + originHost + ')',
				picked: index === 0,
				origin: origin,
			};
		}),
		{
			ignoreFocusOut: true,
			title: 'Select the app origin' + (purposeLabel ? ` for ${purposeLabel}` : '') + ':',
		},
	);

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
		const workspaceRoot = getCurrentWorkspace().uri;
		const err = new Error(
			`Cannot read API key file defined in "${MAKECOMAPP_FILENAME}" origin "${
				origin.label ?? origin.appId ?? 'unnamed'
			}". Check if the file with API key exists and if it is correctly named. It should be placed as text in the file "${path.posix.relative(
				workspaceRoot.path,
				vscode.Uri.joinPath(makeappRootdir, origin.apikeyFile).path,
			)}" of current workspace.`,
			{ cause: e },
		);
		err.name = 'PopupError';
		throw err;
	}
}
