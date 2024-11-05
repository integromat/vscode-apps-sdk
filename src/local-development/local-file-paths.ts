import path from 'node:path';
import sanitize from 'sanitize-filename';
import * as vscode from 'vscode';
import { reserveComponentCodeFilesDirectory } from './reserve-component-dir';
import type { CodeDef } from './types/code-def.types';
import type { CodeType } from './types/code-type.types';
import type { AppComponentMetadata, ComponentCodeFilesMetadata } from './types/makecomapp.types';
import { getAppComponentCodesDefinition } from '../services/component-code-def';
import type { AppComponentType } from '../types/app-component-type.types';
import { camelToKebab } from '../utils/camel-to-kebab';
import { entries } from '../utils/typed-object';

/**
 * Generate a filename (with extension), how it looks to be placed in local fs for local development.
 *
 * @param componentType Note: `undefined` for general codes (Base, Common, Readme)
 * @param filenamePrefix  Note: `undefined` for general codes (Base, Common, Readme).
 *                        For components it uses sanitized component ID, example `getSomething`.
 *                        In this case the output filename starts with sanitizes kebab-case version of this prefix (example: `get-something).
 * @param componentMetadata  Note: `undefined` for general codes (Base, Common, Readme)
 */
export async function generateDefaultLocalFilename(
	codeDef: CodeDef,
	codeType: CodeType,
	componentType: AppComponentType | undefined,
	filenamePrefix: string | undefined,
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
			filename = codeType;
			break;
		default:
			throw new Error(`Type ${typeof codeDef.filename} is not supported in CodeDef.filename`);
	}

	const sanitizedFilenamePrefix = filenamePrefix ? sanitize(camelToKebab(filenamePrefix)) : '';
	const fileNameExt =
		(sanitizedFilenamePrefix ? sanitizedFilenamePrefix + '.' : '') +
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
	componentLocalId: string,
	componentMetadata: AppComponentMetadata,
	localAppRootdir: vscode.Uri,
	includeCommonFiles: boolean,
): Promise<ComponentCodeFilesMetadata> {
	const componentDir = await reserveComponentCodeFilesDirectory(componentType, componentLocalId, localAppRootdir);

	// Detect, which codes are appropriate to the component
	const componentCodesDef = entries(getAppComponentCodesDefinition(componentType)).filter(
		([_codeType, codeDef]) => !codeDef.onlyFor || codeDef.onlyFor(componentMetadata),
	);

	const componentCodeMetadata: ComponentCodeFilesMetadata = {};
	// Process all codes
	for (const [codeType, codeDef] of componentCodesDef) {
		if (codeType === 'common' && !includeCommonFiles) {
			// common data files were selected to ignore
			componentCodeMetadata[codeType] = null;
		} else {
			// Local file path (Relative to app rootdir)
			const codeFilename = await generateDefaultLocalFilename(
				codeDef,
				codeType,
				componentType,
				componentLocalId,
				componentMetadata,
			);
			componentCodeMetadata[codeType] =
				path.posix.relative(localAppRootdir.path, componentDir.path) + '/' + codeFilename;
		}
	}
	return componentCodeMetadata;
}
