import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaConfiguration } from 'vscode-json-languageservice';
import { NotificationType, type LanguageClient } from 'vscode-languageclient/node';
import * as Core from '../Core';
import { log } from '../output-channel';
import { isFileBelongingToExtension } from '../temp-dir';
import type { Environment } from '../types/environment.types';
import * as LanguageServersSettings from '../LanguageServersSettings';
import {
	enrichApiSchemaWithEndpoints,
	extractEndpointInputParameters,
	type SdkEndpointSchemaInfo,
} from './endpoint-api-enrichment';
import { buildEndpointParametersSchema } from './endpoint-parameters-schema';

/**
 * Notification carrying the IMLJSON schema associations sent to the language server. Re-sending it
 * triggers `updateConfiguration()` + a diagnostics refresh on the server (see `jsonServer.ts`).
 */
export const schemaAssociationsNotificationType = new NotificationType<SchemaConfiguration[]>(
	'imljson/schemaAssociations',
);

/**
 * Basenames whose api schema is eligible for online-mode Endpoint enrichment (see
 * {@link ImljsonSchemaAssociations}) — the files whose `endpoint`/`pagination.endpoint` directives
 * reference a sibling Endpoint by name. `attach.imljson`/`detach.imljson` are webhook-only codes and
 * webhooks are non-versionable (`Core.isVersionable`), so their temp paths never carry the version
 * segment `parseAppAndVersion` requires — they're excluded here since they could never actually match.
 * `publish.imljson` likely doesn't occur in v2 online paths either, but is kept for parity/completeness.
 */
const ENRICHABLE_BASENAMES = ['api.imljson', 'publish.imljson'];

/** How long a fetched (or failed) app/version entry is considered fresh, in milliseconds. */
const ENRICHMENT_CACHE_TTL_MS = 60_000;

let parametersSchemaCache: Record<string, unknown> | undefined;
let apiSchemaCache: Record<string, unknown> | undefined;

/**
 * Absolute path of the extension's real `syntaxes/imljson/schemas/` directory.
 */
function schemasDir(): string {
	const extension = vscode.extensions.getExtension('Integromat.apps-sdk')!;
	return path.join(extension.extensionPath, 'syntaxes', 'imljson', 'schemas');
}

/**
 * Absolute `file://` URI of a schema file living next to the real ones in
 * `syntaxes/imljson/schemas/`, resolved the same way as `LanguageServersSettings.getJsonSchemas()`.
 */
function schemaFileUri(filename: string): string {
	return vscode.Uri.file(path.join(schemasDir(), filename)).toString();
}

/**
 * Reads and parses `syntaxes/imljson/schemas/parameters.json` once, lazily, from the extension's own
 * install path.
 */
function getParametersSchema(): Record<string, unknown> {
	if (!parametersSchemaCache) {
		parametersSchemaCache = JSON.parse(
			fs.readFileSync(path.join(schemasDir(), 'parameters.json'), 'utf8'),
		) as Record<string, unknown>;
	}
	return parametersSchemaCache;
}

/**
 * Reads and parses `syntaxes/imljson/schemas/api.json` once, lazily, from the extension's own install
 * path.
 */
function getApiSchema(): Record<string, unknown> {
	if (!apiSchemaCache) {
		apiSchemaCache = JSON.parse(fs.readFileSync(path.join(schemasDir(), 'api.json'), 'utf8')) as Record<
			string,
			unknown
		>;
	}
	return apiSchemaCache;
}

/**
 * Returns the base IMLJSON schema associations (`package.json` -> `contributes` -> `jsonValidation`)
 * plus the derived Endpoint Input/Output Parameters schemas. The latter aren't real files — see
 * {@link buildEndpointParametersSchema} — but their URIs are flat siblings of the real schema files
 * (a non-existent filename in the same directory) so their relative `sources.json#/...` refs still
 * resolve to real files.
 */
export function getStaticAndDerivedSchemaAssociations(): SchemaConfiguration[] {
	const parametersSchema = getParametersSchema();

	return [
		...LanguageServersSettings.getJsonSchemas(),
		{
			uri: schemaFileUri('endpoint-input-parameters.json'),
			fileMatch: ['inputParameters.imljson', '*.input.iml.json'],
			schema: buildEndpointParametersSchema(parametersSchema, 'inputSchema'),
		},
		{
			uri: schemaFileUri('endpoint-output-parameters.json'),
			fileMatch: ['outputParameters.imljson', '*.output.iml.json'],
			schema: buildEndpointParametersSchema(parametersSchema, 'outputSchema'),
		},
	];
}

/**
 * Parses `{app, version}` out of a temp-dir file name the same way `CoreCommands.keepProviders` does:
 * the segment after `apps-sdk` is `/sdk/apps/{app}/{version}/...`; `sdk` is a fixed crumb that gets
 * shifted off, leaving `app` at index 2 and `version` at index 3. Connection/webhook files have no
 * version segment (index 3 isn't numeric) and are intentionally dropped — they're never enriched.
 */
function parseAppAndVersion(fileName: string): { app: string; version: number } | null {
	const afterPrefix = fileName.split('apps-sdk')[1];
	if (!afterPrefix) {
		return null;
	}

	const crumbs = afterPrefix.replace(/\\/g, '/').split('/');
	if (crumbs[1] === 'sdk') {
		crumbs.shift();
	}

	const app = crumbs[2];
	const version = Number(crumbs[3]);
	if (!app || Number.isNaN(version)) {
		return null;
	}
	return { app, version };
}

interface EnrichmentCacheEntry {
	entry?: SchemaConfiguration;
	fetchedAt: number;
}

/** Constructor dependencies of {@link ImljsonSchemaAssociations}. */
export interface ImljsonSchemaAssociationsDependencies {
	client: LanguageClient;
	authorization: string;
	environment: Environment;
}

/**
 * Online-mode-only: enriches the `api.json` schema, per app+version, with that app's actual Endpoint
 * names (so `endpoint`/`pagination.endpoint` validate against — and autocomplete from — real endpoints)
 * and per-endpoint Input Parameter suggestions. Ported from imt-web-zone's
 * `ImlLanguage.getSchemasWithEndpoints` / `buildInputSuggestionEntries`, adapted to this extension's
 * push-based (not on-demand) schema association model.
 *
 * Never throws and never shows a dialog — enrichment is a nice-to-have; failures silently fall back to
 * the static/derived schemas (free-string endpoint name), logged at 'debug'/'warn' via the output channel.
 */
export class ImljsonSchemaAssociations {
	private readonly client: LanguageClient;
	private readonly authorization: string;
	private readonly environment: Environment;
	private readonly cache = new Map<string, EnrichmentCacheEntry>();
	private readonly fetchesInFlight = new Set<string>();

	constructor({ client, authorization, environment }: ImljsonSchemaAssociationsDependencies) {
		this.client = client;
		this.authorization = authorization;
		this.environment = environment;
	}

	/**
	 * Re-evaluates Endpoint enrichment for the newly active editor. A no-op unless the editor is an
	 * online-mode `api.imljson`/`publish.imljson` file (as opposed to a local-dev workspace file, or e.g.
	 * a version-less connection/webhook file).
	 */
	async handleActiveEditorChange(editor: vscode.TextEditor | undefined): Promise<void> {
		try {
			await this.refreshForEditor(editor);
		} catch (err) {
			log('warn', `ImljsonSchemaAssociations: unexpected error while handling active editor change: ${err}`);
		}
	}

	private async refreshForEditor(editor: vscode.TextEditor | undefined): Promise<void> {
		if (!editor) {
			return;
		}

		const fileName = editor.document.fileName;
		if (!isFileBelongingToExtension(fileName) || !ENRICHABLE_BASENAMES.includes(path.basename(fileName))) {
			return;
		}

		const appAndVersion = parseAppAndVersion(fileName);
		if (!appAndVersion) {
			return;
		}

		await this.ensureFreshEntry(appAndVersion);
	}

	private async ensureFreshEntry({ app, version }: { app: string; version: number }): Promise<void> {
		const cacheKey = `${app}/${version}`;
		const cached = this.cache.get(cacheKey);
		if ((cached && Date.now() - cached.fetchedAt < ENRICHMENT_CACHE_TTL_MS) || this.fetchesInFlight.has(cacheKey)) {
			return;
		}

		this.fetchesInFlight.add(cacheKey);
		try {
			const endpoints = await this.fetchEndpoints(app, version);
			if (endpoints === null) {
				// Fetch failed, or the response shape didn't match: keep the last-known-good entry (if any),
				// just push its freshness window out so we don't refetch on every keystroke/editor change.
				this.cache.set(cacheKey, { entry: cached?.entry, fetchedAt: Date.now() });
				return;
			}

			this.cache.set(cacheKey, {
				entry: {
					// A subdirectory would break the schema's relative `sources.json#/...` refs — it must be a
					// flat sibling of the real schema files, like the derived parameter schemas above.
					uri: schemaFileUri(`api-enriched--${app}--v${version}.json`),
					fileMatch: ENRICHABLE_BASENAMES.map(
						(basename) => `**/apps-sdk/**/${app}/${version}/**/${basename}`,
					),
					schema: enrichApiSchemaWithEndpoints(getApiSchema(), endpoints),
				},
				fetchedAt: Date.now(),
			});
			await this.sendAssociations();
		} finally {
			this.fetchesInFlight.delete(cacheKey);
		}
	}

	private async fetchEndpoints(app: string, version: number): Promise<SdkEndpointSchemaInfo[] | null> {
		try {
			const url = `${this.environment.baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer(
				'app',
			)}/${app}/${version}/${Core.pathDeterminer('endpoint')}`;
			const response = await Core.rpGet(url, this.authorization, { includeInputSchema: true }, true);
			const appEndpoints: unknown = response?.appEndpoints;
			if (!Array.isArray(appEndpoints)) {
				return null;
			}

			return appEndpoints
				.filter((item): item is { name: string; inputParameters?: unknown } => typeof item?.name === 'string')
				.map((item) => ({
					name: item.name,
					inputParameters: extractEndpointInputParameters(item.inputParameters),
				}));
		} catch (err) {
			log('debug', `ImljsonSchemaAssociations: failed to fetch endpoints for ${app}/${version}: ${err}`);
			return null;
		}
	}

	private async sendAssociations(): Promise<void> {
		const enrichedEntries = [...this.cache.values()]
			.map((cacheEntry) => cacheEntry.entry)
			.filter((entry): entry is SchemaConfiguration => entry !== undefined);

		await this.client.sendNotification(schemaAssociationsNotificationType, [
			...getStaticAndDerivedSchemaAssociations(),
			...enrichedEntries,
		]);
	}
}
