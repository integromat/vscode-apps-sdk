import { ModuleType } from '../types/component-types.types';

/* eslint-disable camelcase */

export const moduleTypes: ModuleTypeNaming[] = [
	{
		type_id: 1,
		type: 'trigger',
		label: 'Trigger',
	},
	{
		type_id: 4,
		type: 'action',
		label: 'Action',
	},
	{
		type_id: 9,
		type: 'search',
		label: 'Search',
	},
	{
		type_id: 10,
		type: 'instant_trigger',
		label: 'Instant Trigger',
	},
	{
		type_id: 11,
		type: 'responder',
		label: 'Responder',
	},
	{
		type_id: 12,
		type: 'universal',
		label: 'Universal',
	},
];

export function getModuleDefFromId(typeId: number): ModuleTypeNaming {
	const moduleTypeNaming = moduleTypes.find((m) => (m.type_id === typeId));
	if (!moduleTypeNaming) {
		throw new Error(`Unkwnown module type ID ${typeId}.`);
	}
	return moduleTypeNaming;
}

export function getModuleDefFromType(type: string): ModuleTypeNaming {
	const moduleTypeNaming = moduleTypes.find((m) => (m.type === type));
	if (!moduleTypeNaming) {
		throw new Error(`Unkwnown module type ${type}.`);
	}
	return moduleTypeNaming;
}

/**
 * Returns the user friendly name/label of the specified module type.
 */
export function translateModuleTypeId(typeId: number): string {
	try {
		return getModuleDefFromId(typeId).label;
	} catch (_err: unknown) {
		return 'Unknown';
	}
}

interface ModuleTypeNaming {
	type_id: number;
	type: ModuleType;
	label: string;
}
