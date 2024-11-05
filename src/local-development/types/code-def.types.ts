import type { AppComponentType } from '../../types/app-component-type.types';
import type { ApiCodeType } from './code-type.types';
import type { AppComponentMetadata } from './makecomapp.types';

export interface CodeDef {
	/**
	 * Original code type as is used in API endpoints and in the Make backend in general.
	 */
	apiCodeType: ApiCodeType;
	mimetype: string;
	fileext: string;
	/**
	 * Note: In case of resolving function usage:
	 *   componentType and componentMetadata are `undefined` for generic code definition.
	 */
	filename?:
		| string
		| ((
				componentType: AppComponentType | undefined,
				componentMetadata: AppComponentMetadata | undefined,
		  ) => string);
	onlyFor?: (componentMetadata: AppComponentMetadata) => boolean;
}
