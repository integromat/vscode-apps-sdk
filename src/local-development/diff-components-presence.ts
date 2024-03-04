import { AppComponentMetadata, AppComponentTypesMetadata } from './types/makecomapp.types';
import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';

/**
 * Compares list of components from two sources and returns,
 * which components are new and which are misssing in `allComponents`.
 */
export function diffComponentsPresence(
	allComponents: AppComponentTypesMetadata<AppComponentMetadata>,
	reference: AppComponentTypesMetadata<AppComponentMetadata>,
	skipCheckMissing = false,
): {
	/**
	 * Existing in `allComponents`, missing in `reference`
	 * Common meaning: New local component, which not exists in remote Make yet.
	 */
	newComponents: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadata;
	}[];
	/**
	 * Missing in `allComponents`, but existing in `reference`.
	 * Common meaning: Missing in local components, existing in remote Make.
	 */
	missingComponents: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadata;
	}[];
} {
	const ret: ReturnType<typeof diffComponentsPresence> = {
		newComponents: [],
		missingComponents: skipCheckMissing ? [] : diffComponentsPresence(reference, allComponents, true).newComponents,
	};

	for (const [componentType, components] of entries(allComponents)) {
		for (const [componentName, componentMetadata] of entries(components)) {
			const referenceComponentMetadata = reference[componentType]?.[componentName];
			if (referenceComponentMetadata === undefined) {
				ret.newComponents.push({
					componentType,
					componentName,
					componentMetadata,
				});
			}
		}
	}
	return ret;
}
