import { GeneralCodeName } from '../../types/general-code-name.types';
import { AppComponentType } from '../../types/app-component-type.types';
import { Crud } from './crud.types';

export interface MakecomappJson {
	codeFiles: GeneralCodeFilesMetadata;
	components: AppComponentTypesMetadata;
	origins: LocalAppOrigin[];
}

/**
 * Defines the remote Make origin of locally cloned SDK app. It is part of `makecomapp.json`.
 */
export interface LocalAppOrigin {
	/** User friendly title */
	label?: string;
	url: string;
	appId: string;
	appVersion: number;
	apikeyFile: string;
}

export type AppComponentTypesMetadata = Record<AppComponentType, AppComponentsMetadata>;

/** Component ID => Component metadata */
type AppComponentsMetadata = Record<string, AppComponentMetadata>;

interface AppComponentMetadata {
	metadata: {
		label?: string;
		description?: string,
		type?: string,
		actionCrud?: Crud;
		/** Valid for modules */
		connection?: string | null;
		/** Valid for modules */
		altConnection?: string | null;
	},
	codeFiles: ComponentCodeFilesMetadata;
}

/** General Code Name => Code Local File Path */
export type GeneralCodeFilesMetadata = Record<GeneralCodeName, CodeFilePath>;

/** Component's Code Name => Code Local File Path */
export type ComponentCodeFilesMetadata = Record<string, CodeFilePath>;

/**
 * Relative filepath in local filesystem.
 * Relative to directory of `makecomapp.json` or similar metadata file, where is defined.
 */
type CodeFilePath = string;
