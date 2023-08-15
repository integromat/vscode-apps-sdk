import { AppComponentType } from '../types/app-component-type.types';
import { AppComponentMetadata, AppComponentTypesMetadata } from './types/makecomapp.types';

export function diffComponentsPresence(
	allComponentsSummaries: AppComponentTypesMetadata<AppComponentMetadata>,
	reference: AppComponentTypesMetadata<AppComponentMetadata>,
	skipCheckMissing = false,
): {
	newComponents: { componentType: AppComponentType; componentName: string }[];
	missingComponents: { componentType: AppComponentType; componentName: string }[];
} {
	const ret: ReturnType<typeof diffComponentsPresence> = {
		newComponents: [],
		missingComponents: skipCheckMissing
			? []
			: diffComponentsPresence(reference, allComponentsSummaries).newComponents,
	};

	for (const [componentType, components] of Object.entries(allComponentsSummaries)) {
		for (const componentName of Object.keys(components)) {
			const referenceComponentMetadata = reference[componentType as AppComponentType]?.[componentName];
			if (referenceComponentMetadata === undefined) {
				ret.newComponents.push({
					componentType: componentType as AppComponentType,
					componentName,
				});
			}
		}
	}
	return ret;
}
