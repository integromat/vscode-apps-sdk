import * as vscode from 'vscode';
import { getMakecomappJson } from '../makecomappjson';

/**
 * Shows the user dialog with a list of available app connections.
 * User can select one, take the option "- no connection -".
 * @throws {Error} if dialog cancelled by user.
 */
export async function askForLinkConnection(
	anyProjectPath: vscode.Uri,
	connectionTypeLabel: string,
): Promise<string | null | undefined> {
	const makecomappJson = await getMakecomappJson(anyProjectPath);

	// Prepare dialog options
	const pickOptions: (vscode.QuickPickItem & { localID: string | null })[] = [
		// No connection
		{
			label: '- no connection -',
			localID: null,
		},
		// All existing connection as options
		...Object.entries(makecomappJson.components.connection)
			.filter(([_connectionLocalID, connectionMetadata]) => connectionMetadata !== null)
			.map(([connectionLocalID, connectionMetadata]) => ({
				label: `Existing local connection "${connectionMetadata!.label}" [${connectionLocalID}]`,
				localID: connectionLocalID,
			})),
	];

	const componentNamePick = await vscode.window.showQuickPick<(typeof pickOptions)[0]>(pickOptions, {
		ignoreFocusOut: true,
		title: `Select the ${connectionTypeLabel}, which to be linked into new local Remote Procedure:`,
	});
	if (componentNamePick === undefined) {
		return undefined;
	}
	return componentNamePick.localID;
}
