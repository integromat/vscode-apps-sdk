import { Crud } from './crud.types';
import { ComponentCodeType, GeneralCodeType } from './code-type.types';
import { AppComponentType } from '../../types/app-component-type.types';
import { ConnectionType, ModuleType, WebhookType } from '../../types/component-types.types';

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
	idMapping: AppIdMapping;
	appVersion: number;
	apikeyFile: string;
}

export interface LocalAppOriginWithSecret extends LocalAppOrigin {
	apikey: string;
}

export type AppComponentTypesMetadata<T> = Record<AppComponentType, AppComponentsMetadata<T>>;

type AppIdMapping = Record<AppComponentType, IdMappingItem[]>;

interface IdMappingItem {
	/** Note: `null` means that the remote component is not paired to local. In consequences these remote components will be ignored during pull or deploy. */
	local: string | null;
	/** Note: `null` means that the local component is not paired to remote. In consequences these local components will be ignored during pull or deploy. */
	remote: string | null;
}

/** Component ID => Component metadata */
export type AppComponentsMetadata<T> = Record<string, T>;

export interface AppComponentMetadataWithCodeFiles extends AppComponentMetadata {
	codeFiles: ComponentCodeFilesMetadata;
}
export interface AppComponentMetadata {
	label?: string;
	description?: string;
	/**
	 * Relevant for connections only. It describes a type of component itself.
	 * Note: This does NOT describing the type of a connection referenced in `connection` or `altConnection` property.
	 */
	connectionType?: ConnectionType;
	webhookType?: WebhookType;
	/**
	 * Note: In early alpha versions of the `makecomapp.json` the previous property name `moduleSubtype` has been used.
	 *       See `makecomappjson-migrations.ts`, which executes the automatic renaming to new name if old one found.
	 */
	moduleType?: ModuleType;
	actionCrud?: Crud;
	/** Relevant for modules, webhooks, RPCs only. */
	connection?: string | null;
	/** Relevant for modules, webhooks, RPCs only. */
	altConnection?: string | null;
	/** Relevant for module subtype "instant_trigger" only. */
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
