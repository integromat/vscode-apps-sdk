import * as vscode from 'vscode';
import { CodePath } from './types/code-path.types';
import { AppComponentType } from '../types/app-component-type.types';
import { ComponentCodeFilesMetadata, MakecomappJson } from '../local-development/types/makecomapp.types';
import { MAKECOMAPP_FILENAME } from '../local-development/consts';
import { entries, keys } from '../utils/typed-object';

/**
 * Gets app's and component's code, which matches with the local file path.
 */
export function findCodeByFilePath(
	fileRelativePath: string,
	makecomappJson: MakecomappJson,
	makeappRootdir: vscode.Uri,
): CodePath {
	const codes = findCodesByFilePath(fileRelativePath, makecomappJson, makeappRootdir);
	if (codes.length === 0) {
		throw new Error(`Code file ${fileRelativePath} is not defined in ${MAKECOMAPP_FILENAME}.`);
	}
	if (codes.length > 1) {
		throw new Error(`Multiple files unexpectedly found for ${fileRelativePath}`);
	}
	return codes[0];
}

/**
 * Gets all app's and component's codes, which matches with the local filesystem path or are in subdirectories of this path.
 * @param relativePath - If path is directory, it MUST to end with '/'.
 *                       Else horrible things can happen when some another directory has similar name
 *                       starting with same string as first one.
 * @param limit - Limits the maximum count of results. Used if expected the exact one result only. Default is unlimited.
 * @return in correct order to upload to Make without breaking some dependency.
 */
export function findCodesByFilePath(
	relativePath: string,
	makecomappJson: MakecomappJson,
	makeappRootdir: vscode.Uri,
): CodePath[] {
	const ret: CodePath[] = [];

	// Try to find in app's direct configuration codes
	for (const [codeType, codeFilePath] of entries(makecomappJson.generalCodeFiles)) {
		if (codeFilePath === null) {
			// Skip ignored component codes
			continue;
		}
		const codeIsInSubdir = codeFilePath.startsWith(relativePath) || relativePath === '/';
		const codeExactMatch = codeFilePath === relativePath;
		if (codeIsInSubdir || codeExactMatch) {
			const codePath: CodePath = {
				componentType: 'app',
				componentLocalId: '',
				codeType: codeType,
				localFile: vscode.Uri.joinPath(makeappRootdir, codeFilePath),
			};
			if (codeExactMatch) {
				// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
				return [codePath];
			}
			ret.push(codePath);
		}
	}

	// Try to find in compoments
	const appComponentsMetadata = makecomappJson.components;
	for (const [componentType, appComponents] of entries(appComponentsMetadata)) {
		for (const componentLocalId of keys(appComponents)) {
			const codeFilesMetadata: ComponentCodeFilesMetadata = appComponents[componentLocalId]?.codeFiles ?? {};
			for (const [codeType, codeFilePath] of entries(codeFilesMetadata)) {
				if (codeFilePath === null) {
					// Skip ignored component codes
					continue;
				}
				const codeIsInSubdir = codeFilePath.startsWith(relativePath) || relativePath === '/';
				const codeExactMatch = codeFilePath === relativePath;
				if (codeIsInSubdir || codeExactMatch) {
					const codePath: CodePath = {
						componentType: componentType,
						componentLocalId: componentLocalId,
						codeType: codeType,
						localFile: vscode.Uri.joinPath(makeappRootdir, codeFilePath),
					};
					if (codeExactMatch) {
						// In case of exact match, it is impossible to find another match. So we can immediatelly return it.
						return [codePath];
					}
					ret.push(codePath);
				}
			}
		}
	}
	return (
		ret
			// Sort codes to correct order to avoid break some dependency/relation
			.sort((codePath1, codePath2) => {
				return orderToDeploy[codePath1.componentType] - orderToDeploy[codePath2.componentType];
			})
	);
}

const orderToDeploy: Record<AppComponentType | 'app', number> = {
	app: 0, // Generic codes
	connection: 1,
	rpc: 2,
	webhook: 3,
	module: 4,
	function: 5,
};
