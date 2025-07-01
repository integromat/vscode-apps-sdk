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

	/**
	 * Adds/edit component ID-mapping in the memory representation of `makecomapp.json`.
	 */
	addComponentIdMapping(
		componentType: AppComponentType,
		componentLocalId: string | null,
		remoteComponentName: string | null,
		anyProjectPath: vscode.Uri,
		origin: LocalAppOrigin,
	) {
		const originInMakecomappJson = getOriginObject(this.content, origin);

		// Check existing ID-mapping for consistency with the request to map `componentLocalId`<=>`remoteComponentName`
		const existingIdMappingItems =
			originInMakecomappJson.idMapping?.[componentType].filter(
				(idMappingItem) =>
					(idMappingItem.local !== null && idMappingItem.local === componentLocalId) ||
					(idMappingItem.remote !== null && idMappingItem.remote === remoteComponentName),
			) ?? [];
		switch (existingIdMappingItems.length) {
			case 0:
				// Create new ID mapping, because does not exist yet.
				if (!originInMakecomappJson.idMapping) {
					originInMakecomappJson.idMapping = {
						connection: [],
						module: [],
						function: [],
						rpc: [],
						webhook: [],
					};
				}
				// Update `this.content.origins[someOrigin]` in memory
				originInMakecomappJson.idMapping[componentType].push({
					local: componentLocalId,
					remote: remoteComponentName,
				});
				break;
			case 1:
				// Mapping already exists. Check if it is the same one.
				if (
					existingIdMappingItems[0].local !== componentLocalId ||
					existingIdMappingItems[0].remote !== remoteComponentName
				) {
					throw new Error(
						`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where found local=${componentLocalId} or remote=${remoteComponentName}, but it is mapped with another unexpected component.`,
					);
				} // else // already exists the same mapping. Nothing to do.
				break;
			default: // length >= 2
				// Multiple mapping already exists.
				throw new Error(
					`Error in "makecomapp.json" file. Check the "origin"->"idMapping", where multiple records found for (local=${componentLocalId} or remote=${remoteComponentName}).`,
				);
		}
	}
}
