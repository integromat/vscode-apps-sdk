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
	unlinkedRemoteComponents: {componentName: string, componentMetadata: AppComponentMetadata }[],
	targetComponentLocalId: string,
	targetComponentLabel: string | undefined,
): Promise<string | null> {
	const pickOptions: (vscode.QuickPickItem & { name: string | null })[] = [
		// Offer all existing suitable remote components
		...unlinkedRemoteComponents.map((component) => ({
			label: `Existing ${componentType} "${component.componentMetadata.label}" [${component.componentName}]`,
			name: component.componentName,
		})),
		// and offer to create new one
		{ label: `Create new ${componentType} in remote`, name: null },
	];

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
