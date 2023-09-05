import { AppComponentType } from '../types/app-component-type.types';
import { entries } from '../utils/typed-object';
import { AppComponentMetadata, AppComponentTypesMetadata } from './types/makecomapp.types';

/**
 * Compares list of components from two sources and returns,
 * which components are new and which are misssing in `allComponents`.
 */
export function diffComponentsPresence(
	allComponents: AppComponentTypesMetadata<AppComponentMetadata>,
	reference: AppComponentTypesMetadata<AppComponentMetadata>,
	skipCheckMissing = false,
): {
	newComponents: {
		componentType: AppComponentType;
		componentName: string;
		componentMetadata: AppComponentMetadata;
	}[];
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
