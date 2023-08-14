import * as vscode from 'vscode';
import { LocalAppOrigin } from './types/makecomapp.types';

/**
 * Uses VS Code API to display the selection with list of app origins (for multiple origins defined).
 * If origin is one one, nothing asked to user, but instantnly returns this origin.
 * @param origins
 * @param purposeLabel If defined, the text is integrated into dialog message as "Choose ... for ${purposeLabel}:"
 * @returns Return undefined, when there are multiple origins, but user cancels the selection dialog.
 */
export async function askForOrigin(
	origins: LocalAppOrigin[],
	purposeLabel?: string,
): Promise<LocalAppOrigin | undefined> {
	if (!origins?.length) {
		throw new Error('Missing "origins" in makecomapp.json.');
	}

	if (origins.length === 1) {
		return origins[0];
	}

	const selectedOrigin = await vscode.window.showQuickPick(
		origins.map((origin, index) => {
			const label = origin.label || origin.appId + ' ' + origin.appVersion;
			return <{ origin: LocalAppOrigin } & vscode.QuickPickItem>{
				label,
				description: 'at ' + origin.url,
				picked: index === 0,
				origin: origin,
			};
		}),
		{
			ignoreFocusOut: true,
			title: 'Select the app origin' + (purposeLabel ? `for ${purposeLabel}` : '') + ':',
		},
	);
	return selectedOrigin?.origin;
}
