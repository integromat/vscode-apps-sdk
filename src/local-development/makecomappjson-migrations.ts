import cloneDeep from 'lodash/cloneDeep';
import { MakecomappJson } from './types/makecomapp.types';

/**
 * Covers all situations, when the `makecomapp.json` file structure has been changed during PoC/alpha phase of development process.
 * Some users can have local sdk app project with older version of `makecomapp.json`.
 *
 * Function finds the all older/deprecated properties and updates it to the last version.
 * Note: Does NOT to write changes back to the file. Changes are in-memory only as the return value.
 *
 * @param origMakecomappJson makecomapp.json content loaded from project.
 * @returns Upgraded version of makecomapp.json
 */
export function migrateMakecomappJsonFile(origMakecomappJson: MakecomappJson): {
	changesApplied: boolean;
	makecomappJson: MakecomappJson;
} {
	let migrationApplied = false;
	const makecomappJson = cloneDeep(origMakecomappJson);
	if (makecomappJson.components?.module instanceof Object) {
		// Convert `moduleSubtype` => `moduleType`
		Object.values(makecomappJson.components.module).forEach((moduleMetadata) => {
			if (moduleMetadata && (<any>moduleMetadata)?.moduleSubtype) {
				moduleMetadata.moduleType = (<any>moduleMetadata).moduleSubtype;
				delete (<any>moduleMetadata).moduleSubtype;
				migrationApplied = true;
			}
		});
	}
	return {
		changesApplied: migrationApplied,
		makecomappJson,
	};
}
