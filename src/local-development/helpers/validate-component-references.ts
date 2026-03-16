import type { AppComponentType } from '../../types/app-component-type.types';
import type { ComponentIdMappingHelper } from './component-id-mapping-helper';
import type { MakecomappJson } from '../types/makecomapp.types';

interface ReferenceViolation {
	componentType: AppComponentType;
	componentLocalId: string;
	referenceType: 'connection' | 'altConnection' | 'webhook';
	referencedLocalId: string;
}

/**
 * Validates that all component references (connection, altConnection, webhook) in makecomapp.json
 * point to components that have a valid idMapping entry.
 *
 * Should be called after `alignComponentsMapping()` and before the deploy loop,
 * so the user gets a clear error listing all broken references at once.
 *
 * @throws Error if any dangling references are found.
 */
export function validateComponentReferences(
	makecomappJson: MakecomappJson,
	componentIdMapping: ComponentIdMappingHelper,
): void {
	const violations: ReferenceViolation[] = [];

	const componentTypes: AppComponentType[] = ['connection', 'webhook', 'module', 'rpc', 'function'];

	for (const componentType of componentTypes) {
		const components = makecomappJson.components[componentType];
		if (!components) {
			continue;
		}

		for (const [componentLocalId, metadata] of Object.entries(components)) {
			if (!metadata) {
				continue;
			}

			// Check `connection` reference
			if (typeof metadata.connection === 'string') {
				const remoteName = componentIdMapping.getRemoteName('connection', metadata.connection);
				if (remoteName === undefined) {
					// Collect the violation to provide a single aggregated error message at the end
					violations.push({
						componentType,
						componentLocalId,
						referenceType: 'connection',
						referencedLocalId: metadata.connection,
					});
				}
			}

			// Check `altConnection` reference
			if (typeof metadata.altConnection === 'string') {
				const remoteName = componentIdMapping.getRemoteName('connection', metadata.altConnection);
				if (remoteName === undefined) {
					// Collect the violation to provide a single aggregated error message at the end
					violations.push({
						componentType,
						componentLocalId,
						referenceType: 'altConnection',
						referencedLocalId: metadata.altConnection,
					});
				}
			}

			// Check `webhook` reference
			if (typeof metadata.webhook === 'string') {
				const remoteName = componentIdMapping.getRemoteName('webhook', metadata.webhook);
				if (remoteName === undefined) {
					// Collect the violation to provide a single aggregated error message at the end
					violations.push({
						componentType,
						componentLocalId,
						referenceType: 'webhook',
						referencedLocalId: metadata.webhook,
					});
				}
			}
		}
	}

	if (violations.length > 0) {
		const details = violations
			.map(
				(v) =>
					` - ${v.componentType} "${v.componentLocalId}" → ${v.referenceType} "${v.referencedLocalId}" is invalid.`,
			)
			.join(',\n');
		const error = new Error(
			`Validation error: Some components reference to invalid connections/webhooks (component IDs do not exist).\n\n${details}\n\n` +
				`Fix: update the references in makecomapp.json.`,
		);
		error.name = 'PopupError';
		throw error;
	}
}
