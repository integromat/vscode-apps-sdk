import path from 'path';
import * as vscode from 'vscode';
import { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { CodeDef } from './types/code-def.types';
import { AppComponentMetadata, ComponentCodeFilesMetadata } from './types/makecomapp.types';
import { getAppComponentCodesDefinition } from '../services/component-code-def';
import { reserveComponentCodeFilesDirectory } from './reserve-component-dir';
import { getComponentPseudoId } from './component-pseudo-id';
import { CodeType } from './types/code-type.types';
import { entries } from '../utils/typed-object';

/**
 * Generate a filename (with extension), how it looks to be placed in local fs for local development.
 *
 * @param componentType Note: `undefined` for general codes (Base, Common, Readme)
 * @param componentName  Note: `undefined` for general codes (Base, Common, Readme)
 * @param componentMetadata  Note: `undefined` for general codes (Base, Common, Readme)
 */
export async function generateDefaultLocalFilename(
	codeDef: CodeDef,
	codeName: CodeType,
	componentType: AppComponentType | undefined,
	componentName: string | undefined,
	componentMetadata: AppComponentMetadata | undefined,
): Promise<string> {
	let filename: string;
	switch (typeof codeDef.filename) {
		case 'string':
			filename = codeDef.filename;
			break;
		case 'function':
			filename = codeDef.filename(componentType, componentMetadata);
			break;
		case 'undefined':
			filename = codeName;
			break;
		default:
			throw new Error(`Type ${typeof codeDef.filename} is not supported in CodeDef.filename`);
	}

	const fileNameExt =
		(componentName ? camelToKebab(componentName) + '.' : '') +
		// custom filename | component name
		filename +
		// file extension
		'.' +
		codeDef.fileext;

	return fileNameExt;
}

/**
 * Makes decision, which is the right local filepaths to place the component files.
 * Takes the `componentMetadata`, adds `codeFiles` with file paths and returns it.
 *
 * Note: Does NOT create any files. It returns the recommended paths only.
 */
export async function generateComponentDefaultCodeFilesPaths(
	componentType: AppComponentType,
	componentId: string,
	componentMetadata: AppComponentMetadata,
	localAppRootdir: vscode.Uri,
	appId?: string,
): Promise<ComponentCodeFilesMetadata> {
	const componentPseudoId = getComponentPseudoId(componentType, componentId, appId);
	const componentDir = await reserveComponentCodeFilesDirectory(componentType, componentPseudoId, localAppRootdir);

	// Detect, which codes are appropriate to the component
	const componentCodesDef = entries(getAppComponentCodesDefinition(componentType)).filter(
		([_codeName, codeDef]) => !codeDef.onlyFor || codeDef.onlyFor(componentMetadata),
	);

	const componentCodeMetadata: ComponentCodeFilesMetadata = {};
	// Process all codes
	for (const [codeName, codeDef] of componentCodesDef) {
		// Local file path (Relative to app rootdir)
		const codeFilename = await generateDefaultLocalFilename(
			codeDef,
			codeName,
			componentType,
			componentPseudoId,
			componentMetadata,
		);
		componentCodeMetadata[codeName] =
			path.relative(localAppRootdir.fsPath, componentDir.fsPath) + '/' + codeFilename;
	}
	return componentCodeMetadata;
}
