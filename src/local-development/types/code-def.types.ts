import type { AppComponentType } from '../../types/app-component-type.types';
import type { ApiCodeType } from './code-type.types';
import type { AppComponentMetadata } from './makecomapp.types';

export interface CodeDef {
	/**
	 * Original code type as is used in API endpoints and in the Make backend in general.
	 */
	apiCodeType: ApiCodeType;
	/**
	 * Optional override of the key used to look up this code in the origin checksum object.
	 * Needed when the API checksum uses a different (e.g. snake_case DB column) key than `apiCodeType`.
	 * Example: endpoint `inputParameters` section is checksummed under the `input_parameters` column.
	 * Defaults to `apiCodeType` when not set.
	 */
	checksumKey?: string;
	/**
	 * When true, this "code" is not a standalone API section (no `/{apiCodeType}` GET/PUT route).
	 * Instead it is backed by a component **metadata field** named by `apiCodeType`:
	 *  - pull: read the field from the component detail (GET `/{componentType}s/{name}`)
	 *  - deploy: PATCH the component with `{ [apiCodeType]: <fileContent> }`
	 * Example: endpoint `context` (editable as a markdown source file, stored as endpoint metadata).
	 */
	metadataBacked?: boolean;
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
