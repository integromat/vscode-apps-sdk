import path from 'path';
import * as vscode from 'vscode';
import { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { CodeDef } from './types/code-def.types';
import { AppComponentMetadata, ComponentCodeFilesMetadata } from './types/makecomapp.types';
import { getAppComponentCodesDefinition } from '../services/component-code-def';

export function generateDefaultLocalFilePath(
	codeDef: CodeDef,
	codeName: string,
	componentType: AppComponentType | undefined,
	componentName: string | undefined,
	appRootdir: vscode.Uri,
) {
	const filename =
		(componentName ? camelToKebab(componentName) + '.' : '') +
		// custom filename | component name
		(codeDef.filename ? codeDef.filename : codeName) +
		// file extension
		'.' +
		codeDef.fileext;

	if (!componentType || !componentName) {
		return filename;
	}

	// Add component type (like "functions", "modules",...) / [component name] subdirs

	let postfix = 0;
	let localdir: string;
	do {
		localdir = path.join(componentType + 's', camelToKebab(componentName + (postfix ? '-' + postfix : '')));
		postfix++;
	} while (false /** TODO check if directory already exists in fs, then increase postfix */);

	return path.join(localdir, filename);
}

/**
 * Makes decision, which is the right local filepaths to place the component files.
 *
 * Note: Does NOT create any files. It returns the recommended paths only.
 */
export function generateDefaultCodeFilesPaths(
	appComponentType: AppComponentType,
	appComponentName: string,
	componentMetadata: AppComponentMetadata,
	localAppRootdir: vscode.Uri,
): ComponentCodeFilesMetadata {

	// Detect, which codes are appropriate to the component
	const componentCodesDef = Object.entries(getAppComponentCodesDefinition(appComponentType)).filter(
		([_codeName, codeDef]) => !codeDef.onlyFor || codeDef.onlyFor(componentMetadata),
	);

	const componentCodeMetadata: ComponentCodeFilesMetadata = {};
	// Process all codes
	for (const [codeName, codeDef] of componentCodesDef) {
		// Local file path (Relative to app rootdir)
		const codeLocalRelativePath = generateDefaultLocalFilePath(
			codeDef,
			codeName,
			appComponentType,
			appComponentName,
			localAppRootdir,
		);
		componentCodeMetadata[codeName] = codeLocalRelativePath;
	}
	return componentCodeMetadata;
}
