import { ModuleSubtype } from '../types/module-type.types';

export const moduleTypes: {
	type_id: number, type: ModuleSubtype, label: string
}[] = [
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

export function getModuleDefFromId(typeId: number) {
	const moduleType = moduleTypes.find((m) => (m.type_id === typeId));
	if (!moduleType) {
		throw new Error(`Unkwnown module type ID ${typeId}.`);
	}
	return moduleType;
}

export function getModuleDefFromType(type: string) {
	const moduleType = moduleTypes.find((m) => (m.type === type));
	if (!moduleType) {
		throw new Error(`Unkwnown module type ${type}.`);
	}
	return moduleType;
}

export function translateModuleTypeId(typeId: number): string {
	try {
		return getModuleDefFromId(typeId).label;
	} catch (_err: unknown) {
		return 'Unknown';
	}
}
