import * as vscode from 'vscode';

const rulesDescription =
	'3-30 lowercase letters (a-z), numbers (0-9), and dashes (-). Must start with a letter, not end with a dash.';

/**
 * Display the VS Code input box to ask user to enter the module ID.
 * Makes the validation of entered value. If invalid, it repeats the question until valid or cancelled.
 */
export async function askModuleID(): Promise<string | undefined> {
	let moduleID: string | undefined;
	do {
		moduleID = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: 'Examples: get-something, list-something, update-something, ...',
			title:
				(moduleID !== undefined ? 'INVALID FORMAT. Try again to ' : '') +
				'Enter the module ID (name) of new module to be created:',
			prompt: 'Rules: ' + rulesDescription,
			value: moduleID,
		});
		if (moduleID === undefined) {
			return undefined;
		}
	} while (!hasIdValidFormat(moduleID));
	return moduleID;
}

/**
 * Tests if the ID (name) has the correct format defined by Make.
 */
function hasIdValidFormat(id: string): boolean {
	return /^[a-z][0-9a-z-]{1,28}[0-9a-z]$/.test(id);
}
