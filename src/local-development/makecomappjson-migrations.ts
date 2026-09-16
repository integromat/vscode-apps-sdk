import cloneDeep from 'lodash/cloneDeep';
import type { MakecomappJson } from './types/makecomapp.types';
import { AppComponentTypes } from '../types/app-component-type.types';

/**
 * Covers all situations, when the `makecomapp.json` file structure has been changed during PoC/alpha phase of development process.
 * Some users can have local Custom App project with older version of `makecomapp.json`.
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
			if (moduleMetadata && (moduleMetadata as any)?.moduleSubtype) {
				moduleMetadata.moduleType = (moduleMetadata as any).moduleSubtype;
				delete (moduleMetadata as any).moduleSubtype;
				migrationApplied = true;
			}
		});
	}

	// Backfill component types added in later versions (e.g. `endpoint`).
	// Projects cloned before a new component type existed have `components`/`idMapping` without its key.
	// Several mapping accessors do `idMapping?.[type].filter(...)` (guarding only `idMapping`, not the key),
	// so a missing key would crash on pull/deploy. Ensure every current component type is present.
	if (makecomappJson.components instanceof Object) {
		for (const componentType of AppComponentTypes) {
			if (!makecomappJson.components[componentType]) {
				makecomappJson.components[componentType] = {};
				migrationApplied = true;
			}
		}
	}
	for (const origin of makecomappJson.origins ?? []) {
		// Only normalize origins that already have an `idMapping`. A fully missing `idMapping` is safely
		// handled by the optional-chaining in the accessors and is (re)created on demand.
		if (origin.idMapping) {
			for (const componentType of AppComponentTypes) {
				if (!origin.idMapping[componentType]) {
					origin.idMapping[componentType] = [];
					migrationApplied = true;
				}
			}
		}
	}

	return {
		changesApplied: migrationApplied,
		makecomappJson,
	};
}
