import * as vscode from 'vscode';
import { AppComponentMetadata } from './types/makecomapp.types';
import { AppComponentType } from '../types/app-component-type.types';

export const anwersSpecialCases = {
	CREATE_NEW_COMPONENT: Symbol('Create new compoment in counterparty'),
};

/**
 * Opens dialog, which asks user to do with component unmapped to counterparty.
 * Note: If answer is obvious, the dialog is skipped and function will "autoanswer".
 *
 * @return componentName if one is selected. Or Symbor if answered to create or ignore.
 * @throws {Error} if dialog cancelled by user.
 */
export async function askForSelectMappedComponent(
	componentLocation: 'local' | 'remote',
	componentType: AppComponentType,
	componentIdOrName: string,
	componentLabel: string | undefined,
	counterpartyComponents: { componentName: string; componentMetadata: AppComponentMetadata }[],
): Promise<string | null | symbol> {
	const counterpartyComponentsLocation = componentLocation === 'local' ? 'remote' : 'local';

	// Try to autoanswer if the answer is obvious (local and remote components matched)
	const matchedComponents = counterpartyComponents.filter(
		(cc) =>
			countSimilarityScore(
				{ name: componentIdOrName, label: componentLabel },
				{ name: cc.componentName, label: cc.componentMetadata.label },
			) > 0,
	);
	if (matchedComponents.length === 1) {
		return matchedComponents[0].componentName;
	}

	// Prepare dialog options
	const pickOptions: (vscode.QuickPickItem & { name: string | null | symbol; similarityScore: number })[] = [
		// Offer all existing suitable counterparty components
		...counterpartyComponents.map((component) => ({
			label: `Existing ${counterpartyComponentsLocation} ${componentType} "${component.componentMetadata.label}" [${component.componentName}]`,
			name: component.componentName,
			similarityScore: countSimilarityScore(
				{ label: componentLabel, name: componentIdOrName },
				{ label: component.componentMetadata.label, name: component.componentName },
			),
		})),
		// and offer to create new one
		{
			label: `Create new ${counterpartyComponentsLocation} ${componentType}`,
			name: anwersSpecialCases.CREATE_NEW_COMPONENT,
			similarityScore: -1,
		},
		// and offer to create ignore
		{
			label: `Ignore permanently / do not map with ${counterpartyComponentsLocation}`,
			name: null,
			similarityScore: -2,
		},
	];

	// Most similar remote connection should be on the top (as the first choice)
	pickOptions.sort((obj1, obj2) => obj2.similarityScore - obj1.similarityScore);

	const componentNamePick = await vscode.window.showQuickPick<(typeof pickOptions)[0]>(pickOptions, {
		ignoreFocusOut: true,
		title: `Select a counterparty for unmapped ${componentLocation} ${componentType} "${
			componentLabel ?? '[no-label]'
		}" [${componentIdOrName}]:`,
	});
	if (componentNamePick === undefined) {
		throw new Error('Cancelled by user.');
	}
	return componentNamePick.name;
}

interface ScoreInputObj {
	name: string;
	label: string | undefined;
}

/**
 * Indentifies the similarity of components based on their names and labels.
 * @return positive number if there is some similarity. Higher score means higher similarity. Zero if no similarity found.
 */
function countSimilarityScore(obj1: ScoreInputObj, obj2: ScoreInputObj): number {
	let totalScore = 0;

	if (
		typeof obj1.label === 'string' &&
		typeof obj2.label === 'string' &&
		obj1.label.toLowerCase() === obj2.label.toLowerCase()
	) {
		totalScore += 1;
	}

	if (obj1.name === obj2.name) {
		totalScore += 2;
	}
	return totalScore;
}
