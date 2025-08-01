import * as vscode from 'vscode';
import { generateAndReserveComponentLocalId, getMakecomappJson, updateMakecomappJson } from '../makecomappjson';
import type { ComponentIdMappingItem, LocalAppOrigin, MakecomappJson } from '../types/makecomapp.types';
import type { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';
import { getOriginObject } from './get-origin-object';
import { ComponentIdMappingHelper } from './component-id-mapping-helper';

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

	/*private getMappingByRemoteName(componentType: AppComponentType | AppGeneralType, remoteName: string) {
		if (componentType === 'app') {
			// This is special case, where "Common", "Readme" (etc.) are considered as members of virtual "app" compoment type, which has single component with ID ``.
			return '';
		}

		const originInMakecomappJson = getOriginObject(this.content, remoteName);

		const matchedMappings =
			originInMakecomappJson.idMapping?.[componentType].filter((mapping) => mapping.remote === remoteName) ?? [];

		if (matchedMappings.length === 0) {
			return undefined;
		}

		if (matchedMappings.length >= 2) {
			throw new Error(`Not unique mapping found for remote name "${remoteName}"`);
		}

		return matchedMappings[0];
	}

	getLocalId(componentType: AppComponentType | AppGeneralType, remoteName: string): string | undefined {
		this.content.origins.forEach((origin) => {
			
			if (!origin.idMapping) {
				return;
			}
			if (!origin.idMapping[componentType]) {
				return;
			}
		
		const mapping = this.getMappingByRemoteName(componentType, remoteName);
		if (!mapping) {
			return mapping; // returns string "" and undefined
		}
		return mapping.local;
	}*/
		
	/**
	 * Returns the local ID for the given component, or creates a new one if it does not exist.
	 * Returns `null` if the component type is 'app' or if the mapping already exists.
	 */
	async getLocalIdOrCreateNew(
		componentType: AppComponentType | AppGeneralType,
		origin: LocalAppOrigin,
		remoteName: string,
	): Promise<string | null> {
		const localId = this.getComponentIdMappingHelper(origin).getLocalId(componentType, remoteName);
		if (localId !== undefined) {
			// undefined meant 'not exists' in idMapping
			return localId;
		}

		// Create new local ID
		const originInMakecomappJson = getOriginObject(this.content, origin);
		if (!originInMakecomappJson.idMapping) {
			originInMakecomappJson.idMapping = {
				function: [],
				connection: [],
				webhook: [],
				module: [],
				rpc: [],
			};
		}
		if (componentType !== 'app' && !originInMakecomappJson.idMapping[componentType]) {
			originInMakecomappJson.idMapping[componentType] = [];

			// we have to create new local ID, because it does not exist yet.
			const newLocalId = await generateAndReserveComponentLocalId(componentType, '', this.anyProjectPath);
			const newMapping: ComponentIdMappingItem = {
				local: newLocalId,
				remote: remoteName,
				localDeleted: false,
			};

			originInMakecomappJson.idMapping[componentType].push(newMapping);

			await this.saveChanges(); // Save changes to makecomapp.json
			return newLocalId;
		}

		return null;
	}
}
