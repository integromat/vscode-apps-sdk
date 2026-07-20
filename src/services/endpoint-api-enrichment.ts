import { toFormanSchema, type FormanSchemaField } from '@makehq/forman-schema';
import * as jsoncParser from 'jsonc-parser';
import type { JSONSchema7 } from 'json-schema';

/**
 * Suggestion for an Endpoint input parameter's key, surfaced when a module references that Endpoint.
 */
export interface EndpointInputParameter {
	name: string;
	description?: string;
	/**
	 * Nested key suggestions, when this parameter is a `collection` with known sub-fields — see
	 * {@link _toSuggestion}. Absent for leaves, including `array` fields (see there for why arrays don't
	 * recurse).
	 */
	properties?: EndpointInputParameter[];
}

/**
 * The subset of an app's Endpoint metadata needed to enrich api.json for online-mode validation.
 */
export interface SdkEndpointSchemaInfo {
	name: string;
	inputParameters: EndpointInputParameter[];
}

const _isPrimitive = (value: unknown): value is string | number | boolean =>
	typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/**
 * Builds a `{name, description}` suggestion from a Forman Schema field, or `undefined` if it has no
 * (string) `name`. `label` is preferred for the description text — the raw API's Input Parameters use
 * it — falling back to `help` (the only descriptive text `toFormanSchema` produces, from a JSON Schema's
 * `description`).
 *
 * Recurses into `field.spec` when `field.type === 'collection'`, attaching the result as `properties` —
 * this is the one function shared by both the raw-item path and the JSON-Schema-unwrap path (see
 * {@link _extractFromJsonSchema}), so a nested object surfaces its own nested keys regardless of which
 * path produced it. Deliberately excludes `type: 'array'`: an array's `.spec` describes its *item*
 * shape, not a property bag of the array field itself (a real "sku" item-property isn't a direct
 * `arrayField.sku` key — it belongs to each array element), so treating it the same as a `collection`
 * would suggest a key that doesn't actually exist at that path.
 */
function _toSuggestion(field: FormanSchemaField): EndpointInputParameter | undefined {
	if (typeof field.name !== 'string') {
		return undefined;
	}

	const descriptionParts = [
		_isPrimitive(field.label) ? String(field.label) : _isPrimitive(field.help) ? String(field.help) : undefined,
		_isPrimitive(field.type) ? `(${field.type})` : undefined,
		field.required === true ? 'required' : undefined,
	].filter((part): part is string => part !== undefined);

	const properties =
		field.type === 'collection' && Array.isArray(field.spec)
			? field.spec
					.map(_toSuggestion)
					.filter((suggestion): suggestion is EndpointInputParameter => suggestion !== undefined)
			: undefined;

	return {
		name: field.name,
		description: descriptionParts.length ? descriptionParts.join(' ') : undefined,
		...(properties?.length ? { properties } : {}),
	};
}

/**
 * Unwraps a `type: 'json'` parameter's `schema` (a raw JSON Schema — e.g. describing the endpoint's whole
 * input as `{type:'object', properties:{...}}`) into suggestions, via `@makehq/forman-schema`'s
 * `toFormanSchema` — Make's own JSON-Schema-to-Forman-Schema converter, used here instead of a bespoke
 * `properties` walker so this stays correct as that mapping evolves.
 *
 * `converted.spec`'s entries are turned into suggestions via {@link _toSuggestion}, which recurses into
 * nested `collection`-typed properties on its own — see there for how deep that goes and why `array`
 * properties don't. Bails to `[]` for anything that isn't a non-null object, that `toFormanSchema` rejects
 * (it throws on malformed input), or that doesn't convert to named sub-fields (e.g. an array or primitive
 * JSON Schema has no `spec` array).
 */
function _extractFromJsonSchema(schema: unknown): EndpointInputParameter[] {
	if (typeof schema !== 'object' || schema === null) {
		return [];
	}

	let converted: FormanSchemaField;
	try {
		converted = toFormanSchema(schema as JSONSchema7);
	} catch {
		return [];
	}

	if (!Array.isArray(converted.spec)) {
		return [];
	}

	return converted.spec
		.map(_toSuggestion)
		.filter((suggestion): suggestion is EndpointInputParameter => suggestion !== undefined);
}

/**
 * Extracts `{name, description}` suggestions from an Endpoint's raw Input Parameters section (the
 * `inputParameters` field of the `.../endpoints/{name}` API response — an IMLJSON string, or an
 * already-parsed value).
 *
 * Suggestions-only, never validation: the parameters section can have exotic shapes this helper doesn't
 * need to fully understand, so anything that isn't a plain array of Forman Schema fields — a parse
 * failure, a non-array value, an item without a string `name`, … — is silently skipped rather than
 * throwing. Names are extracted recursively into nested `collection`-typed sub-fields (see
 * {@link _toSuggestion}); a `type: 'json'` item's `schema` is also unwrapped, recursively, the same way
 * (see {@link _extractFromJsonSchema}) — when that yields anything, it *replaces* the item's own
 * name/label, since a wrapped-schema item's own name (conventionally `inputSchema`/`outputSchema`, see
 * `endpoint-parameters-schema.ts`) isn't a real `input` key at runtime.
 *
 * Deviation from the ported web-zone original: the raw section is IMLJSON and may contain comments, so a
 * string value is parsed with `jsonc-parser` (already a dependency here) instead of `JSON.parse`.
 *
 * @param value - The endpoint's raw `inputParameters` field.
 * @returns The extracted suggestions, or `[]` if `value` isn't (or doesn't parse to) an array.
 */
export function extractEndpointInputParameters(value: unknown): EndpointInputParameter[] {
	let parameters = value;
	if (typeof parameters === 'string') {
		parameters = jsoncParser.parse(parameters);
	}

	if (!Array.isArray(parameters)) {
		return [];
	}

	const result: EndpointInputParameter[] = [];
	for (const item of parameters) {
		if (typeof item !== 'object' || item === null) {
			continue;
		}

		if ((item as { type?: unknown }).type === 'json') {
			const unwrapped = _extractFromJsonSchema((item as { schema?: unknown }).schema);
			if (unwrapped.length > 0) {
				result.push(...unwrapped);
				continue;
			}
		}

		const suggestion = _toSuggestion(item as FormanSchemaField);
		if (suggestion) {
			result.push(suggestion);
		}
	}

	return result;
}

/**
 * `endpoint`/`pagination.endpoint` accept either the shorthand string form or the `{name, ...}` object
 * form (see api.json), so matching "this endpoint reference is named X" must check both. The object
 * branch needs an explicit `type: 'object'` guard — otherwise `properties`/`required` are no-ops against
 * a plain string, so it would (incorrectly) match every string value.
 */
function _endpointNameIs(endpointName: string): Record<string, unknown> {
	return {
		oneOf: [
			{ const: endpointName },
			{ type: 'object', properties: { name: { const: endpointName } }, required: ['name'] },
		],
	};
}

/**
 * Recursively turns `EndpointInputParameter[]` into a JSON Schema `properties` map: `description` per
 * key, plus a nested `properties` map when that parameter itself carries sub-fields. No `type`,
 * `additionalProperties`, or `required` at any depth, so this stays suggestion-only all the way down —
 * see {@link _buildInputSuggestionEntries}.
 */
function _buildPropertiesSchema(parameters: EndpointInputParameter[]): Record<string, unknown> {
	return Object.fromEntries(
		parameters.map(({ name, description, properties }) => [
			name,
			{
				...(description ? { description } : {}),
				...(properties?.length ? { properties: _buildPropertiesSchema(properties) } : {}),
			},
		]),
	);
}

/**
 * Builds the `request.allOf` entries that turn each endpoint's known Input Parameters into
 * suggestion-only `input`/`pagination.input` key completions: one entry for the base `input`, one for
 * `pagination.input` when `pagination.endpoint` overrides the endpoint, and a fallback for
 * `pagination.input` when `pagination` has no `endpoint` override (so it reuses the base endpoint's
 * parameters). Endpoints without parameters contribute nothing.
 *
 * The injected `properties` carry no `additionalProperties` and no `required` at any depth (see
 * {@link _buildPropertiesSchema}), so the editor offers the keys (with hover docs) in completion but can
 * never flag an unknown or missing key — this is a suggestion, not validation, because the parameters
 * section can have shapes (`json` `schema`, …) this helper never inspects.
 */
function _buildInputSuggestionEntries(endpoints: SdkEndpointSchemaInfo[]): Record<string, unknown>[] {
	const entries: Record<string, unknown>[] = [];

	for (const endpoint of endpoints) {
		if (!endpoint.inputParameters.length) {
			continue;
		}

		const properties = _buildPropertiesSchema(endpoint.inputParameters);

		entries.push(
			{
				if: { required: ['endpoint'], properties: { endpoint: _endpointNameIs(endpoint.name) } },
				then: { properties: { input: { properties } } },
			},
			{
				if: {
					required: ['pagination'],
					properties: {
						pagination: {
							required: ['endpoint'],
							properties: { endpoint: _endpointNameIs(endpoint.name) },
						},
					},
				},
				then: { properties: { pagination: { properties: { input: { properties } } } } },
			},
			{
				if: {
					required: ['endpoint', 'pagination'],
					properties: {
						endpoint: _endpointNameIs(endpoint.name),
						pagination: { not: { required: ['endpoint'] } },
					},
				},
				then: { properties: { pagination: { properties: { input: { properties } } } } },
			},
		);
	}

	return entries;
}

/**
 * Returns a copy of api.json with `definitions.endpointName` constrained to the given endpoints' names
 * (shared by `endpoint.name` and `pagination.endpoint.name`), so a module's Endpoint reference validates
 * against — and autocompletes from — the app's existing endpoints. An IML expression (`{{ }}`) is still
 * accepted for a dynamic name.
 *
 * Also appends, per endpoint with known Input Parameters, suggestion-only completions for the keys of
 * `input`/`pagination.input` — see {@link extractEndpointInputParameters}.
 *
 * The caller decides whether the app's endpoint list is known at all; this function always receives a
 * concrete array (an empty array still narrows `name` to "no valid plain-string value", an IML
 * expression is still accepted).
 *
 * @param apiSchema - The parsed `syntaxes/imljson/schemas/api.json` content. Not mutated.
 * @param endpoints - The app's endpoints, with known Input Parameters where available.
 * @returns A deep-copied, endpoint-enriched variant of `apiSchema`.
 */
export function enrichApiSchemaWithEndpoints(
	apiSchema: Record<string, unknown>,
	endpoints: SdkEndpointSchemaInfo[],
): Record<string, unknown> {
	const schema = JSON.parse(JSON.stringify(apiSchema)) as Record<string, unknown>;
	const definitions = schema.definitions as Record<string, Record<string, unknown>>;

	const endpointNames = endpoints.map((endpoint) => endpoint.name);
	const nameDef = definitions.endpointName;
	definitions.endpointName = {
		description: nameDef.description,
		oneOf: [{ type: 'string', enum: [...endpointNames] }, { $ref: 'sources.json#/definitions/stringWithIml' }],
	};

	const request = definitions.request;
	request.allOf = [...(request.allOf as unknown[]), ..._buildInputSuggestionEntries(endpoints)];

	return schema;
}
