/* eslint-disable @typescript-eslint/consistent-indexed-object-style */

import type { Crud } from './crud.types';
import type { ComponentCodeType, GeneralCodeType } from './code-type.types';
import type { AppComponentType } from '../../types/app-component-type.types';
import type { ConnectionType, ModuleType, WebhookType } from '../../types/component-types.types';

export interface MakecomappJson {
	fileVersion: number;
	generalCodeFiles: GeneralCodeFilesMetadata;
	components: AppComponentTypesMetadata;
	origins: LocalAppOrigin[];
}

/**
 * Defines the remote Make origin of locally cloned Custom App. It is part of `makecomapp.json`.
 */
export interface LocalAppOrigin {
	/**
	 * User friendly title of remote origin.
	 * Useful if multiple origins are defined in a project.
	 * @pattern ^(?!-FILL-ME-)
	 */
	label?: string;
	/**
	 * Home Make.com instance of Custom apps.
	 * Example: `https://eu1.make.com/api`.
	 * Note: Need to select the correct instance `eu1, `eu2`, `us1`, `us2`, etc.
	 * @format uri
	 * @pattern ^https://(.*)/api$
	 */
	baseUrl: string;
	/**
	 * App ID od custom app in Make.com instance.
	 * @pattern ^[a-z][0-9a-z-]+[0-9a-z]$
	 */
	appId: string;
	idMapping?: ComponentIdMapping;
	/**
	 * Major version of the app.
	 * Note: App version is 1 in most cases.
	 */
	appVersion: number;
	/**
	 * Path to file with API Token.
	 * Path can be written as relative to this makecomapp.json file, or as absolute.
	 * @pattern ^(?!.* - OR FILL)
	 */
	apikeyFile: string;
}

export interface LocalAppOriginWithSecret extends LocalAppOrigin {
	apikey: string;
}

export type AppComponentTypesMetadata = Record<AppComponentType, AppComponentsMetadata>;

/**
 * List of component ID-mapping between local and remote components of same component type (like modules, connections, ...).
 */
type ComponentIdMapping = Record<AppComponentType, ComponentIdMappingItem[]>;

export interface ComponentIdMappingItem {
	/** Note: `null` means that the remote component is not paired to local. In consequences these remote components will be ignored during pull or deploy. */
	local: string | null;
	/** Note: `null` means that the local component is not paired to remote. In consequences these local components will be ignored during pull or deploy. */
	remote: string | null;
	/** Note: True indicates that the component was deleted locally and must be aligned with the origin.  */
	localDeleted?: boolean;
}

/**
 * Component ID => Component metadata or null (null can be temporary in makecomapp.json file)
 *
 * Note: `null` is used only temporary if component name is reserved, but not implemeted yet.
 */
interface AppComponentsMetadata {
	[key: string]: AppComponentMetadataWithCodeFiles | null;
}
// IMPORTANT: Do not use format `type AppComponentsMetadata = Record<string, AppComponentMetadataWithCodeFiles | null>;
//            because not supported by lib `typescript-json-schema` used in `npm run schema:makecomapp`.

export interface AppComponentMetadataWithCodeFiles extends AppComponentMetadata {
	codeFiles: ComponentCodeFilesMetadata;
}

/**
 * Base interface for all child intrfaces of `AppComponentMetadata` and `AppComponentMetadataRemoteIDs`.
 */
export interface AppComponentMetadataBase {
	/**
	 * Relevance:
	 *  - connection: yes
	 *  - webhook: yes
	 *  - module: yes
	 *  - RPC: yes
	 *  - IML function: no
	 */
	label?: string;

	/**
	 * Relevance:
	 *  - connection: no
	 *  - webhook: no
	 *  - module: yes
	 *  - RPC: no
	 *  - IML function: no
	 */
	description?: string;
	/**
	 * Relevant for connections only. It describes a type of component itself.
	 * Note: This does NOT describing the type of a connection referenced in `connection` or `altConnection` property.
	 */
	connectionType?: ConnectionType;
	/**
	 * Relevant for webhooks only.
	 */
	webhookType?: WebhookType;
	//
	// Note: In early alpha versions of the `makecomapp.json` the previous property name `moduleSubtype` has been used.
	//       See `makecomappjson-migrations.ts`, which executes the automatic renaming to new name if old one found.
	moduleType?: ModuleType;
	actionCrud?: Crud;
}

/**
 * Base interace for final type `AppComponentMetadata`
 */
interface AppComponentMetadataInternal extends AppComponentMetadataBase {
	/** Relevant for modules, webhooks, RPCs only. */
	connection?: string | null;
	/** Relevant for modules, webhooks, RPCs only. */
	altConnection?: string | null;
	/** Relevant for module subtype "instant_trigger" only, mandatory there. */
	webhook?: string | null;
}

/**
 * Base interace for final type `AppComponentMetadataRemoteIDs`
 */
interface AppComponentMetadataRemoteIDsInternal extends AppComponentMetadataBase {
	/** Relevant for modules, webhooks, RPCs only. */
	connectionRemoteId?: string | null;
	/** Relevant for modules, webhooks, RPCs only. */
	altConnectionRemoteId?: string | null;
	/** Relevant for module subtype "instant_trigger" only, mandatory there. */
	webhookRemoteId?: string | null;
}

// Prevent the two interfaces from being used interchangeably
// Required, because these two interfaces has differences in optional properties only.
type Tagged<T, Tag> = T & { __tag?: Tag };
export type AppComponentMetadata = Tagged<AppComponentMetadataInternal, 'LocalIDs'>;
export type AppComponentMetadataRemoteIDs = Tagged<AppComponentMetadataRemoteIDsInternal, 'RemoteIDs'>;

/**
 * General Code Type => Code Local File Path.
 *
 *  If `CodeFilePath` is `null`, it means the code is being ignored in local development (during pulls and deployments).
 *  The `null` used primarly for common data in case a developer decided to not include common data in local project.
 */
export type GeneralCodeFilesMetadata = Record<GeneralCodeType, CodeFilePath | null>;

/**
 * Component's Code Type => Code Local File Path
 *
 *  If `CodeFilePath` is `null`, it means the code is being ignored in local development (during pulls and deployments).
 *  The `null` used primarly for common data in case a developer decided to not include common data in local project.
 */
export type ComponentCodeFilesMetadata = Partial<Record<ComponentCodeType, CodeFilePath | null>>;

/**
 * Relative filepath in local filesystem.
 * Relative to directory of `makecomapp.json` or similar metadata file, where is defined.
 */
type CodeFilePath = string;
