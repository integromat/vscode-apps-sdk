import type { AppComponentType } from '../types/app-component-type.types';

/**
 * The order is defined to avoid break any dependencies (like references to connection from other components)
 */
export const componentTypesDeployOrder: Record<AppComponentType | 'app', number> = {
	app: 0, // Generic codes
	connection: 1,
	rpc: 2,
	webhook: 3,
	module: 4,
	function: 5,
};
