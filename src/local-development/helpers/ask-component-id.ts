import * as vscode from 'vscode';

/**
 * Display the VS Code input box to ask user to enter the component local ID.
 * Makes the validation of entered value. If invalid, it repeats the question until valid or cancelled.
 */
export async function askNewComponentLocalID(
	componentTypeLabel: string,
	mandatory: boolean,
): Promise<string | undefined> {
	// TODO IMPLEMENT `mandatory`

	let componentID: string | undefined;
	do {
		componentID = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: 'Examples: get-something, list-something, update-something, ...',
			title:
				(componentID !== undefined ? 'INVALID FORMAT. Try again to ' : '') +
				`What local ID should be used for new local ${componentTypeLabel}?`,
			prompt: 'Rules: 3-48 letters and numbers (a-z, A-Z, 0-9). Must start with a letter.',
			value: componentID,
		});
		if (componentID === undefined) {
			// Cancelled by user
			return undefined;
		}
	} while (!/^[a-zA-Z][0-9a-zA-Z]{2,47}$/.test(componentID));
	return componentID;
}
