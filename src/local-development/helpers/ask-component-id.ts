import * as vscode from 'vscode';
import { COMPONENT_ID_VALIDATION_RULES, isComponentLocalIdValid } from './validate-id';
import type { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

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
			placeHolder: `Examples: ${COMPONENT_ID_VALIDATION_RULES[componentType].examples}, ...`,
			title:
				(componentID !== undefined ? 'INVALID FORMAT, TRY AGAIN: ' : '') +
				(componentType === 'function'
					? 'Enter a name for the new function:'
					: `What local ID should be used for new ${componentType}?`) +
				(mandatory ? '' : ' Answer is optional: Keep empty to autogenerate the ID.'),
			prompt:
				'Rules: ' +
				COMPONENT_ID_VALIDATION_RULES[componentType].hint +
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
