import cloneDeep from 'lodash.clonedeep';
import { MakecomappJson } from './types/makecomapp.types';

/**
 * Covers all situations, when the `makecomapp.json` file structure has been changed during agile development process.
 * Therefore some users has local sdk app project with older version of `makecomapp.json`.
 *
 * Function finds the all odler/deprecated properties and updates it to the last version.
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
			if (moduleMetadata && (<any>moduleMetadata).moduleSubtype) {
				moduleMetadata.moduleType = (<any>moduleMetadata).moduleSubtype;
				delete (<any>moduleMetadata).moduleSubtype;
				migrationApplied = true;
			}
		});
	}

	// TODO Add mapping  if not exists

	return {
		changesApplied: migrationApplied,
		makecomappJson,
	};
}
