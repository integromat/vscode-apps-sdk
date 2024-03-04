import * as vscode from 'vscode';
import { isValidID } from './validate-id';

// const rulesDescription =
//	'3-30 lowercase letters (a-z), numbers (0-9), and dashes (-). Must start with a letter, not end with a dash.';
const moduleRulesDescription =
	'3-48 letters and numbers (a-z, A-Z, 0-9). Must start with a letter.';

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
			prompt: 'Rules: ' + moduleRulesDescription,
			value: moduleID,
		});
		if (moduleID === undefined) {
			return undefined;
		}
	} while (!isValidID('module', moduleID));
	return moduleID;
}


