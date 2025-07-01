import * as vscode from 'vscode';
import { getMakecomappJson, updateMakecomappJson } from '../makecomappjson';
import type { LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';
import type { AppComponentType } from '../../types/app-component-type.types';
import { getOriginObject } from './get-origin-object';

/**
 * Represents the content of `makecomapp.json` and methods, which are possible to execute over this content.
 *
 * TODO: The idea is to refactor some node modules from stand-alone non-class functions into class based structure.
 */
export class MakecomappJsonFile {
	/**
	 * @param content The in-memory representation of `makecomapp.json` file content.
	 */
	private constructor(public content: MakecomappJson, private anyProjectPath: vscode.Uri) {}

	/**
	 * Creates new class instance with the freshly loaded file content.
	 * @param anyProjectPath
	 * @returns New class instance
	 */
	public static async fromLocalProject(anyProjectPath: vscode.Uri): Promise<MakecomappJsonFile> {
		const content = await getMakecomappJson(anyProjectPath);
		return new MakecomappJsonFile(content, anyProjectPath);
	}

	/**
	 * Save changes to the `makecomapp.json` file in the local project.
	 */
	public async saveChanges(): Promise<void> {
		return updateMakecomappJson(this.anyProjectPath, this.content);
	}

	/**
	 * Gets whether the project contains the common data or ignores it.
	 * The decision is based on including or excluding app common data file.
	 */
	public get isCommonDataIncluded(): boolean {
		return Boolean(this.content.generalCodeFiles.common);
	}

	public getComponentIdMappingHelper(origin: LocalAppOrigin): ComponentIdMappingHelper {
		return new ComponentIdMappingHelper(this.content, origin);
	}

}
