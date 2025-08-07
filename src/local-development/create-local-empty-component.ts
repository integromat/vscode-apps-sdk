import * as vscode from 'vscode';
import type { AppComponentMetadata, AppComponentMetadataWithCodeFiles } from './types/makecomapp.types';
import { generateAndReserveComponentLocalId, upsertComponentInMakecomappjson } from './makecomappjson';
import { generateComponentDefaultCodeFilesPaths } from './local-file-paths';
import { getEmptyCodeContent } from './helpers/get-empty-code-content';
import { MakecomappJsonFile } from './helpers/makecomapp-json-file-class';
import { entries } from '../utils/typed-object';
import type { AppComponentType } from '../types/app-component-type.types';

/**
 * Handles the VS Code right click and select "Create local component: IML Function".
 *
 * Asks user for couple of details about intended IML function and then creates it, including local files.
 */
export async function createLocalEmptyComponent(
	componentType: AppComponentType,
	preferedComponentLocalId: string,
	componentMetadata: AppComponentMetadata,
	makeappRootdir: vscode.Uri,
	nonOwnedByApp = false,
): Promise<{ componentMetadata: AppComponentMetadataWithCodeFiles; componentLocalId: string }> {
	// Validate `componentMetadata` for mandatory additional data
	switch (componentType) {
		case 'module':
			if (!componentMetadata.moduleType) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.moduleType", but it is required for ${componentType} ${preferedComponentLocalId} creation.`,
				);
			}
			if (componentMetadata.moduleType === 'action' && componentMetadata.actionCrud === undefined) {
				throw new Error(
					`Cannot create local ${componentType}, because missing "componentMetadata.actionCrud", but it is required to be defined for ${componentType} ${preferedComponentLocalId} creation.`,
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

	const includeCommonData = (await MakecomappJsonFile.fromLocalProject(makeappRootdir)).isCommonDataIncluded;

	const componentMetadataWithCodeFiles: AppComponentMetadataWithCodeFiles = {
		...componentMetadata,
		// Generate Local file paths (Relative to app rootdir) + store metadata
		// when the connection is not owned by the app, dont create code files
		codeFiles: nonOwnedByApp ? {} : await generateComponentDefaultCodeFilesPaths(
			componentType,
			newComponentLocalId,
			componentMetadata,
			makeappRootdir,
			includeCommonData,
		),
	};
	// Write empty files (empty JSON objects or arrays)
	for (const [codeType, codeFilePath] of entries(componentMetadataWithCodeFiles.codeFiles)) {
		if (codeFilePath) {
			const codeFileUri = vscode.Uri.joinPath(makeappRootdir, codeFilePath);
			await vscode.workspace.fs.writeFile(
				codeFileUri,
				new TextEncoder().encode(getEmptyCodeContent(codeType, newComponentLocalId)),
			);
		} // else skip ignored cide files (mostly common data files are being ignored).
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
