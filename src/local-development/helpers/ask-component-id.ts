import * as vscode from 'vscode';
import { isComponentLocalIdValid } from './validate-id';
import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

/**
 * Displays the VS Code input box to ask user to enter the component local ID.
 * Makes the validation of entered value. If invalid, it repeats the question until valid or cancelled.
 */
export async function askNewComponentLocalID(
	componentType: AppComponentType,
	mandatory: boolean,
): Promise<string | undefined> {
	let componentID: string | undefined;
	do {
		componentID = await vscode.window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: 'Examples: get-something, list-something, update-something, ...',
			title:
				(componentID !== undefined ? 'INVALID FORMAT, TRY AGAIN: ' : '') +
				`What local ID should be used for new local ${componentType}?` +
				(mandatory ? '' : ' Answer is optional: Keep empty to autogenerate the ID.'),
			prompt:
				'Rules: ' +
				'3-48 letters and numbers (a-z, A-Z, 0-9). Must start with a letter.' +
				// This requirements are not exactly the truth. The real limitations are less strict,
				//   but the decision is to not confuse developer by exact limitation specifications.
				//   See `isComponentLocalIdValid()` for exact rules.
				(mandatory ? '' : ' Or keep empty.'),
			value: componentID,
		});
		if (componentID === undefined) {
			// Cancelled by user
			return undefined;
		}
	} while (!componentIdAnswerIsValid(componentType, componentID, mandatory));
	return componentID;
}

function componentIdAnswerIsValid(
	componentType: AppComponentType | AppGeneralType,
	componentID: string,
	mandatory: boolean,
): boolean {
	return (!mandatory && componentID === '') || isComponentLocalIdValid(componentType, componentID);
}
