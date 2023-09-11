import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

/**
 * Tests if the ID (name) has the correct format aligned with Make rules.
 */
export function isValidID(componentType: AppComponentType | AppGeneralType, id: string): boolean {
	switch (componentType) {
		case 'app':
			return /^[a-z][0-9a-z-]{1,28}[0-9a-z]$/.test(id);
		case 'rpc':
		case 'module':
			return /^[a-zA-Z][0-9a-zA-Z]{3,47}$/.test(id);
		case 'webhook':
		case 'connection':
			// Generated automatically
			return true;
		case 'function':
			// TODO Implement the validation here
			return true;
	}
}
