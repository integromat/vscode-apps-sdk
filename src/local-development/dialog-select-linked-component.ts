import * as vscode from 'vscode';
import { AppComponentType } from '../types/app-component-type.types';
import { AppComponentMetadata } from './types/makecomapp.types';

/**
 *
 * @return componentName if one is selected. `null` if selected `create new`.
 * @throws {Error} if dialog cancelled by user.
 */
export async function askForSelectLinkedComponent(
	componentType: AppComponentType,
	unlinkedRemoteComponents: { componentName: string; componentMetadata: AppComponentMetadata }[],
	targetComponentLocalId: string,
	targetComponentLabel: string | undefined,
): Promise<string | null> {
	const pickOptions: (vscode.QuickPickItem & { name: string | null; similarityScore: number })[] = [
		// Offer all existing suitable remote components
		...unlinkedRemoteComponents.map((component) => ({
			label: `Existing ${componentType} "${component.componentMetadata.label}" [${component.componentName}]`,
			name: component.componentName,
			similarityScore: countSimilarityScore(
				{ label: targetComponentLabel, name: targetComponentLocalId },
				{ label: component.componentMetadata.label, name: component.componentName },
			),
		})),
		// and offer to create new one
		{ label: `Create new ${componentType} in remote`, name: null, similarityScore: -1 },
	];

	// Most similar remote connection should be on the top (as the first choice)
	pickOptions.sort((obj1, obj2) => obj2.similarityScore - obj1.similarityScore);

	const componentNamePick = await vscode.window.showQuickPick<(typeof pickOptions)[0]>(pickOptions, {
		ignoreFocusOut: true,
		title: `Select the remote ${componentType}, which the local ${componentType} "${
			targetComponentLabel ?? '[no-label]'
		}" [${targetComponentLocalId}] should be linked to:`,
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
