import * as vscode from 'vscode';
import { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateAndReserveComponentLocalId, upsertComponentInMakecomappjson } from './makecomappjson';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getEmptyCodeContent } from './helpers/get-empty-code-content';
import { entries } from '../utils/typed-object';
import { AppComponentType } from '../types/app-component-type.types';

/**
 * Creates new component in local development.
 * = Creates all necessary files and adds new component with `componentMetadata` to `makecomapp.json`.
 *
 * @param preferedComponentLocalId - Can contain an expected local ID or can contain also the original component remote name.
 */
export async function createLocalEmptyComponent(
	componentType: AppComponentType,
	preferedComponentLocalId: string,
	componentMetadata: AppComponentMetadata,
	makeappRootdir: vscode.Uri,
): Promise<{ componentMetadata: AppComponentMetadataWithCodeFiles; componentLocalId: string }> {
	// Validate `componentMetadata` for mandatory additional data
	switch (componentType) {
		case 'module':
			if (!componentMetadata.moduleType) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.moduleType", but it is required for ${componentType} ${preferedComponentLocalId} creation.`,
				);
			}
			if (componentMetadata.moduleType === 'action' && !componentMetadata.actionCrud) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.actionCrud", but it is required for ${componentType} ${preferedComponentLocalId} creation.`,
				);
			}
			break;
		case 'connection':
			if (!componentMetadata.connectionType) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.connectionType", but it is required for ${componentType} ${preferedComponentLocalId} creation.`,
				);
			}
			break;
		case 'webhook': {
			if (!componentMetadata.webhookType) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.webhookType", but it is required for ${componentType} ${preferedComponentLocalId} creation.`,
				);
			}
			break;
		}
	}

	const newComponentLocalId = await generateAndReserveComponentLocalId(
		componentType,
		preferedComponentLocalId,
		makeappRootdir,
	);

	const componentMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles = {
		...componentMetadata,
		// Generate Local file paths (Relative to app rootdir) + store metadata
		codeFiles: await generateComponentDefaultCodeFilesPaths(
			componentType,
			newComponentLocalId,
			componentMetadata,
			makeappRootdir,
		),
	};
	// Write empty files (empty JSON objects or arrays)
	for (const [codeType, codeFilePath] of entries(componentMetadataWithCodeFiles.codeFiles)) {
		const codeFileUri = vscode.Uri.joinPath(makeappRootdir, codeFilePath);
		await vscode.workspace.fs.writeFile(codeFileUri, new TextEncoder().encode(getEmptyCodeContent(codeType)));
	}

	// Write changes to makecomapp.json file
	await upsertComponentInMakecomappjson(
		componentType,
		newComponentLocalId,
		null,
		componentMetadataWithCodeFiles,
		makeappRootdir,
		null,
	);

	return {
		componentMetadata: componentMetadataWithCodeFiles,
		componentLocalId: newComponentLocalId,
	};
}
