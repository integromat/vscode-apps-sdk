import * as vscode from 'vscode';
import type { AppComponentMetadata } from './types/makecomapp.types';
import type { AppComponentType } from '../types/app-component-type.types';

export const specialAnswers = {
	CREATE_NEW_COMPONENT: Symbol('Create new compoment in counterparty'),
	CREATE_NEW_COMPONENT__FOR_ALL: Symbol("Create new compoment in counterparty (apply for all, don't ask again)"),
	MAP_WITH_NULL: Symbol('Ignore compoment in counterparty'),
	MAP_WITH_NULL__FOR_ALL: Symbol("Ignore compoment in counterparty (apply for all, don't ask again)"),
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
): Promise<string | symbol> {
	const counterpartyComponentsLocation = componentLocation === 'local' ? 'remote' : 'local';
	const actionText = componentLocation === 'local' ? 'Deploy' : 'Pull';

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
	const pickOptions: (vscode.QuickPickItem & { name: string | symbol; similarityScore: number })[] = [
		// Offer all existing suitable counterparty components
		...counterpartyComponents.map((component) => ({
			label: `Existing ${counterpartyComponentsLocation} ${componentType} "${component.componentMetadata.label}" [${component.componentName}]`,
			name: component.componentName,
			similarityScore: countSimilarityScore(
				{ label: componentLabel, name: componentIdOrName },
				{ label: component.componentMetadata.label, name: component.componentName },
			),
		})),
		// offer to create new one
		{
			label: `${actionText} as new ${counterpartyComponentsLocation} ${componentType}`,
			name: specialAnswers.CREATE_NEW_COMPONENT,
			similarityScore: -1,
		},
		// offer to create new one (apply for all)
		...(counterpartyComponents.length === 0
			? [
					{
						label: `${actionText} as new ${counterpartyComponentsLocation} ${componentType} (and Apply for all unmapped)`,
						name: specialAnswers.CREATE_NEW_COMPONENT__FOR_ALL,
						similarityScore: -2,
					},
			  ]
			: []),
		// offer to ignore
		{
			label: `Ignore ${counterpartyComponentsLocation} component permanently`,
			name: specialAnswers.MAP_WITH_NULL,
			similarityScore: -3,
		},
		// offer to ignore (apply for all)
		...(counterpartyComponents.length === 0
			? [
					{
						label: `Ignore ${counterpartyComponentsLocation} component permanently (and Apply for all unmapped)`,
						name: specialAnswers.MAP_WITH_NULL__FOR_ALL,
						similarityScore: -4,
					},
			  ]
			: []),
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
 * Identifies the similarity of components based on their names and labels.
 *
 * Positive number if there is some similarity.
 * Higher score means higher similarity.
 * Zero if no similarity found.
 *
 * Score is cumulated based on rules:
 *
 * - Same label => score +1
 * - Same component ID (name) => score +2
 *
 * @return Total score
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
