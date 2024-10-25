import { AppComponentType } from '../types/app-component-type.types';
import { log } from '../output-channel';
import { removeModuleFromGroups } from './groups-json';
import vscode from 'vscode';
import { getMakecomappJson, updateMakecomappJson } from './makecomappjson';
import { ComponentIdMappingHelper } from './helpers/component-id-mapping-helper';

export async function deleteLocalComponent(anyProjectPath: vscode.Uri, componentType: AppComponentType, localComponentName: string) {
	log('info', `Deleting local ${componentType} '${localComponentName}'`);

	// Remove module groups
	if (componentType === 'module') {
		// TODO need to remap localComponentName -> originName (but its hard due to origins)
		await removeModuleFromGroups(anyProjectPath, localComponentName);
	}

	// TODO should we try to find references? Delete used connection, rpc etc?

	// Load manifest
	const makecomappJson = await getMakecomappJson(anyProjectPath);

	// Remove component from manifest
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { [localComponentName]: _ignored, ...updatedComponents } = makecomappJson.components[componentType];
	makecomappJson.components[componentType] = updatedComponents;

	// Add localDeleted property to mapping
	for (const origin of makecomappJson.origins) {
		const mappingHelper = new ComponentIdMappingHelper(makecomappJson, origin);
		mappingHelper.addLocalDeleted(componentType, localComponentName);
	}

	// Save manifest
	await updateMakecomappJson(anyProjectPath, makecomappJson);
}
