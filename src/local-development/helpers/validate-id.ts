import { AppComponentType, AppGeneralType } from '../../types/app-component-type.types';

/**
 * Tests if the ID (name) has the correct format aligned with Make rules.
 */
export function isComponentLocalIdValid(componentType: AppComponentType | AppGeneralType, id: string): boolean {
	switch (componentType) {
		case 'app':
			return /^[a-z][0-9a-z-]{1,28}[0-9a-z]$/.test(id);
		case 'rpc':
		case 'module':
		case 'function':
			// Local ID must match the format requirements at Make.
			//   Reason: If remote component not exists yet, the "Deploy to Make" action tries to create it with same component name as local ID.
			return /^[a-zA-Z][0-9a-zA-Z]{2,47}$/.test(id);
		case 'webhook':
		case 'connection':
			// Note: Remote name is generated automatically in format `(appName)(index)?` and not need to match with local ID.
			//       No need to limit the local ID, so no need to be strict, but code files will contain choosed local ID,
			//       so we blocks weird symbols and spaces that can be incompatible/problematic in for filesystem.
			return /^[0-9a-zA-Z_-]{3,28}?$/.test(id);
	}
}
