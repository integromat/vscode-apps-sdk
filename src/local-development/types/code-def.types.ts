import { AppComponentType } from '../../types/app-component-type.types';
import { AppComponentMetadata } from './makecomapp.types';

export interface CodeDef {
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
