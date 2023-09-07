import { AppComponentType } from '../../types/app-component-type.types';
import { Crud } from './crud.types';
import { ConnectionType, ModuleType, WebhookType } from '../../types/module-type.types';
import { ComponentCodeType, GeneralCodeType } from './code-type.types';

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
	moduleType?: ModuleType; // TODO drive "moduleSubtype" - dodelat migraci
	actionCrud?: Crud;
	/** Valid for modules, webhooks, RPCs only */
	connection?: string | null;
	/** Valid for modules, webhooks, RPCs only */
	altConnection?: string | null;
	/** Valid for module subtype "instant_trigger" only */
	webhook?: string | null;
}

/** General Code Type => Code Local File Path */
export type GeneralCodeFilesMetadata = Record<GeneralCodeType, CodeFilePath>;

/** Component's Code Type => Code Local File Path */
export type ComponentCodeFilesMetadata = Partial<Record<ComponentCodeType, CodeFilePath>>;

/**
 * Relative filepath in local filesystem.
 * Relative to directory of `makecomapp.json` or similar metadata file, where is defined.
 */
type CodeFilePath = string;
