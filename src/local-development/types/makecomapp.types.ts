import { GeneralCodeName } from '../../types/general-code-name.types';
import { AppComponentType } from '../../types/app-component-type.types';
import { Crud } from './crud.types';
import { ConnectionType, ModuleSubtype, WebhookType } from '../../types/module-type.types';

export interface MakecomappJson {
	fileVersion: number;
	generalCodeFiles: GeneralCodeFilesMetadata;
	components: AppComponentTypesMetadata<AppComponentMetadataWithCodeFiles>;
	origins: LocalAppOrigin[];
}

/**
 * Defines the remote Make origin of locally cloned SDK app. It is part of `makecomapp.json`.
 */
export interface LocalAppOrigin {
	/** User friendly title */
	label?: string;
	baseUrl: string;
	appId: string;
	appVersion: number;
	apikeyFile: string;
}

export interface LocalAppOriginWithSecret extends LocalAppOrigin {
	apikey: string;
}

export type AppComponentTypesMetadata<T> = Record<AppComponentType, AppComponentsMetadata<T>>;

/** Component ID => Component metadata */
export type AppComponentsMetadata<T> = Record<string, T>;


export interface AppComponentMetadataWithCodeFiles extends AppComponentMetadata {
	codeFiles: ComponentCodeFilesMetadata;
}
export interface AppComponentMetadata {
	label?: string;
	description?: string;
	connectionType?: ConnectionType;
	webhookType?: WebhookType;
	moduleSubtype?: ModuleSubtype;
	actionCrud?: Crud;
	/** Valid for modules, webhooks, rpcs */
	// connection?: string | null;
	/** Valid for modules, webhooks, rpcs */
	// altConnection?: string | null;
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
