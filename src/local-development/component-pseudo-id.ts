import { AppComponentType } from '../types/app-component-type.types';

/**
 * Explanation: Some component ID (like connections and may be some other kind of components)
 * have naming convention as [appId][index].
 *
 * For this case this function returns [componentType][index].
 * If no postfix (first connection), function returns '1'.
 *
 * If naming convention is not based on [appId], returns original componentId.
 */
export function getComponentPseudoId(
	componentType: AppComponentType,
	componentId: string,
	appId: string | undefined,
): string {
	if (!appId || !componentId.startsWith(appId)) {
		return componentId;
	}
	return componentType + (componentId.substring(appId.length) || '1');
}
