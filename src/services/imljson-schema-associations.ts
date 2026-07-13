import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { SchemaConfiguration } from 'vscode-json-languageservice';
import { NotificationType } from 'vscode-languageclient/node';
import * as LanguageServersSettings from '../LanguageServersSettings';
import { buildEndpointParametersSchema } from './endpoint-parameters-schema';

/**
 * Notification carrying the IMLJSON schema associations sent to the language server. Re-sending it
 * triggers `updateConfiguration()` + a diagnostics refresh on the server (see `jsonServer.ts`).
 */
export const schemaAssociationsNotificationType = new NotificationType<SchemaConfiguration[]>(
	'imljson/schemaAssociations',
);

let parametersSchemaCache: Record<string, unknown> | undefined;

/**
 * Absolute `file://` URI of a schema file living next to the real ones in
 * `syntaxes/imljson/schemas/`, resolved the same way as `LanguageServersSettings.getJsonSchemas()`.
 */
function schemaFileUri(filename: string): string {
	const extension = vscode.extensions.getExtension('Integromat.apps-sdk')!;
	return vscode.Uri.file(path.join(extension.extensionPath, 'syntaxes', 'imljson', 'schemas', filename)).toString();
}

/**
 * Reads and parses `syntaxes/imljson/schemas/parameters.json` once, lazily, from the extension's own
 * install path.
 */
function getParametersSchema(): Record<string, unknown> {
	if (!parametersSchemaCache) {
		const extension = vscode.extensions.getExtension('Integromat.apps-sdk')!;
		const parametersSchemaPath = path.join(
			extension.extensionPath,
			'syntaxes',
			'imljson',
			'schemas',
			'parameters.json',
		);
		parametersSchemaCache = JSON.parse(fs.readFileSync(parametersSchemaPath, 'utf8')) as Record<string, unknown>;
	}
	return parametersSchemaCache;
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
