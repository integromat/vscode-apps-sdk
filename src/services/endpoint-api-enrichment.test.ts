import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { suite, test } from 'mocha';
import { enrichApiSchemaWithEndpoints, extractEndpointInputParameters } from './endpoint-api-enrichment';

function loadApiSchema(): Record<string, unknown> {
	const schemaPath = path.join(__dirname, '../../syntaxes/imljson/schemas/api.json');
	return JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
}

function definitionsOf(schema: Record<string, unknown>): Record<string, Record<string, unknown>> {
	return schema.definitions as Record<string, Record<string, unknown>>;
}

suite('extractEndpointInputParameters()', () => {
	test('extracts names and descriptions from a JSON-string array', () => {
		const json = JSON.stringify([{ name: 'cursor', label: 'Cursor', type: 'text', required: true }]);
		assert.deepStrictEqual(extractEndpointInputParameters(json), [
			{ name: 'cursor', description: 'Cursor (text) required' },
		]);
	});

	test('extracts from an already-parsed array', () => {
		assert.deepStrictEqual(extractEndpointInputParameters([{ name: 'cursor' }]), [
			{ name: 'cursor', description: undefined },
		]);
	});

	test('parses IMLJSON with comments (jsonc-parser deviation)', () => {
		const jsonc = '[\n  // a comment\n  {"name":"cursor", "label":"Cursor"} /* trailing */\n]';
		assert.deepStrictEqual(extractEndpointInputParameters(jsonc), [{ name: 'cursor', description: 'Cursor' }]);
	});

	test('returns an empty array for invalid JSON, a non-array value, or items without a string name', () => {
		assert.deepStrictEqual(extractEndpointInputParameters('{not valid json'), []);
		assert.deepStrictEqual(extractEndpointInputParameters({ name: 'not-an-array' }), []);
		assert.deepStrictEqual(extractEndpointInputParameters([{ label: 'no name' }, 'a string item', null, 42]), []);
	});

	test('never throws on exotic parameter shapes (nested spec/schema, banners, …)', () => {
		const exotic = [
			{ name: 'inputSchema', type: 'json', schema: { type: 'object', properties: {} } },
			{ name: 'account', type: 'collection', spec: [{ name: 'id', type: 'text' }] },
			{ type: 'banner', title: 'Heads up' },
		];

		assert.doesNotThrow(() => extractEndpointInputParameters(exotic));
		assert.deepStrictEqual(extractEndpointInputParameters(exotic), [
			{ name: 'inputSchema', description: '(json)' },
			{
				name: 'account',
				description: '(collection)',
				properties: [{ name: 'id', description: '(text)' }],
			},
		]);
	});

	test('unwraps a wrapped JSON Schema (type:"json" + schema) into flat suggestions, via @makehq/forman-schema', () => {
		const parameters = [
			{
				name: 'inputSchema',
				type: 'json',
				schema: {
					$schema: 'http://json-schema.org/draft-04/schema#',
					title: 'Product',
					description: 'A product from Acme catalog',
					type: 'object',
					properties: {
						id: { description: 'The unique identifier for a product', type: 'integer' },
						name: { description: 'Name of the product', type: 'string' },
					},
					required: ['id', 'name'],
				},
			},
		];

		// The wrapper's own name (`inputSchema`) is not a real `input` key at runtime, so it's replaced
		// by the unwrapped properties rather than also appearing alongside them.
		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{ name: 'id', description: 'The unique identifier for a product (number) required' },
			{ name: 'name', description: 'Name of the product (text) required' },
		]);
	});

	test('extracts both an ordinary field and an unwrapped wrapped-schema field from a mixed array', () => {
		const parameters = [
			{ name: 'page', label: 'Page number', type: 'integer' },
			{
				name: 'inputSchema',
				type: 'json',
				schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
			},
		];

		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{ name: 'page', description: 'Page number (integer)' },
			{ name: 'id', description: '(number) required' },
		]);
	});

	test('recurses into a nested object property, surfacing its own sub-keys', () => {
		const parameters = [
			{
				name: 'inputSchema',
				type: 'json',
				schema: {
					type: 'object',
					properties: {
						address: { type: 'object', properties: { city: { type: 'string' } } },
					},
				},
			},
		];

		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{
				name: 'address',
				description: '(collection)',
				properties: [{ name: 'city', description: '(text)' }],
			},
		]);
	});

	test('recurses through multiple levels (deeply nested objects)', () => {
		const parameters = [
			{
				name: 'inputSchema',
				type: 'json',
				schema: {
					type: 'object',
					properties: {
						id: { description: 'The unique identifier for a product', type: 'integer' },
						name: { description: 'Name of the product', type: 'string' },
						nested: {
							description: 'blabla',
							type: 'object',
							properties: {
								deep: { description: 'blabla', type: 'boolean' },
							},
						},
					},
					required: ['id', 'name'],
				},
			},
		];

		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{ name: 'id', description: 'The unique identifier for a product (number) required' },
			{ name: 'name', description: 'Name of the product (text) required' },
			{
				name: 'nested',
				description: 'blabla (collection)',
				properties: [{ name: 'deep', description: 'blabla (boolean)' }],
			},
		]);
	});

	test('a native (non-json) Forman `collection` field recurses the same way as an unwrapped JSON Schema', () => {
		const parameters = [
			{
				name: 'address',
				type: 'collection',
				label: 'Address',
				spec: [{ name: 'city', type: 'text', label: 'City' }],
			},
		];

		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{
				name: 'address',
				description: 'Address (collection)',
				properties: [{ name: 'city', description: 'City (text)' }],
			},
		]);
	});

	test('does not recurse into an array field, even when its items are objects', () => {
		const parameters = [
			{
				name: 'inputSchema',
				type: 'json',
				schema: {
					type: 'object',
					properties: {
						items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' } } } },
					},
				},
			},
		];

		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [{ name: 'items', description: '(array)' }]);
	});

	test('falls back to the bare name when schema is missing, empty, array/primitive-typed, or malformed', () => {
		const parameters = [
			{ name: 'noSchema', type: 'json' },
			{ name: 'emptyObjectSchema', type: 'json', schema: { type: 'object' } },
			{ name: 'emptyPropsSchema', type: 'json', schema: { type: 'object', properties: {} } },
			{ name: 'arraySchema', type: 'json', schema: { type: 'array', items: { type: 'string' } } },
			{ name: 'primitiveSchema', type: 'json', schema: { type: 'string' } },
			{ name: 'garbageSchema', type: 'json', schema: 'not an object' },
			{ name: 'nullSchema', type: 'json', schema: null },
		];

		assert.doesNotThrow(() => extractEndpointInputParameters(parameters));
		assert.deepStrictEqual(extractEndpointInputParameters(parameters), [
			{ name: 'noSchema', description: '(json)' },
			{ name: 'emptyObjectSchema', description: '(json)' },
			{ name: 'emptyPropsSchema', description: '(json)' },
			{ name: 'arraySchema', description: '(json)' },
			{ name: 'primitiveSchema', description: '(json)' },
			{ name: 'garbageSchema', description: '(json)' },
			{ name: 'nullSchema', description: '(json)' },
		]);
	});
});

suite('enrichApiSchemaWithEndpoints()', () => {
	const apiSchema = loadApiSchema();

	test('constrains endpointName to the given endpoints (plus an IML expression)', () => {
		const result = enrichApiSchemaWithEndpoints(apiSchema, [
			{ name: 'getUser', inputParameters: [] },
			{ name: 'listUsers', inputParameters: [] },
		]);
		const nameDef = definitionsOf(result).endpointName;

		assert.deepStrictEqual(nameDef.oneOf, [
			{ type: 'string', enum: ['getUser', 'listUsers'] },
			{ $ref: 'sources.json#/definitions/stringWithIml' },
		]);
		assert.ok(nameDef.description, 'description is preserved so hover docs still work');
	});

	test('locks out every plain-string name (IML expression still allowed) when the app has zero endpoints', () => {
		const result = enrichApiSchemaWithEndpoints(apiSchema, []);
		assert.deepStrictEqual(definitionsOf(result).endpointName.oneOf, [
			{ type: 'string', enum: [] },
			{ $ref: 'sources.json#/definitions/stringWithIml' },
		]);
	});

	test('does not mutate the input schema', () => {
		const before = JSON.parse(JSON.stringify(apiSchema));
		enrichApiSchemaWithEndpoints(apiSchema, [{ name: 'getUser', inputParameters: [] }]);
		assert.deepStrictEqual(apiSchema, before);
	});

	test('injects 3 suggestion-only allOf entries for an endpoint with parameters, none without', () => {
		const baseAllOfLength = (definitionsOf(apiSchema).request.allOf as unknown[]).length;

		const withParams = enrichApiSchemaWithEndpoints(apiSchema, [
			{ name: 'listUsers', inputParameters: [{ name: 'page', description: 'Page number' }] },
		]);
		assert.strictEqual((definitionsOf(withParams).request.allOf as unknown[]).length, baseAllOfLength + 3);

		const withoutParams = enrichApiSchemaWithEndpoints(apiSchema, [{ name: 'getUser', inputParameters: [] }]);
		assert.strictEqual((definitionsOf(withoutParams).request.allOf as unknown[]).length, baseAllOfLength);
	});

	test('the injected input-suggestion entries carry no `required`/`additionalProperties`', () => {
		const result = enrichApiSchemaWithEndpoints(apiSchema, [
			{ name: 'listUsers', inputParameters: [{ name: 'page', description: 'Page number' }] },
		]);
		const allOf = definitionsOf(result).request.allOf as Record<string, any>[];

		const matchesListUsers = {
			oneOf: [
				{ const: 'listUsers' },
				{ type: 'object', properties: { name: { const: 'listUsers' } }, required: ['name'] },
			],
		};

		const baseEntry = allOf.find((entry) => entry.then?.properties?.input && !entry.if?.properties?.pagination);
		assert.ok(baseEntry);
		assert.deepStrictEqual(baseEntry.if, { required: ['endpoint'], properties: { endpoint: matchesListUsers } });
		assert.deepStrictEqual(baseEntry.then.properties.input.properties, { page: { description: 'Page number' } });
		assert.strictEqual(baseEntry.then.properties.input.additionalProperties, undefined);
		assert.strictEqual(baseEntry.then.properties.input.required, undefined);

		const overrideEntry = allOf.find((entry) => entry.if?.properties?.pagination?.required);
		assert.ok(overrideEntry);
		assert.deepStrictEqual(overrideEntry.if.properties.pagination.properties.endpoint, matchesListUsers);
		assert.deepStrictEqual(overrideEntry.then.properties.pagination.properties.input.properties, {
			page: { description: 'Page number' },
		});

		const fallbackEntry = allOf.find(
			(entry) => entry.if?.properties?.pagination?.not && entry.if?.properties?.endpoint,
		);
		assert.ok(fallbackEntry);
		assert.deepStrictEqual(fallbackEntry.if.properties.endpoint, matchesListUsers);
		assert.deepStrictEqual(fallbackEntry.if.properties.pagination, { not: { required: ['endpoint'] } });
		assert.deepStrictEqual(fallbackEntry.then.properties.pagination.properties.input.properties, {
			page: { description: 'Page number' },
		});
	});

	test('nested `properties` on an Input Parameter are injected recursively, still with no `required`/`additionalProperties`', () => {
		const result = enrichApiSchemaWithEndpoints(apiSchema, [
			{
				name: 'listUsers',
				inputParameters: [
					{
						name: 'address',
						description: 'Address (collection)',
						properties: [{ name: 'city', description: 'City (text)' }],
					},
				],
			},
		]);
		const allOf = definitionsOf(result).request.allOf as Record<string, any>[];

		const baseEntry = allOf.find((entry) => entry.then?.properties?.input && !entry.if?.properties?.pagination);
		assert.ok(baseEntry);
		assert.deepStrictEqual(baseEntry.then.properties.input.properties, {
			address: {
				description: 'Address (collection)',
				properties: { city: { description: 'City (text)' } },
			},
		});
		assert.strictEqual(baseEntry.then.properties.input.properties.address.additionalProperties, undefined);
		assert.strictEqual(baseEntry.then.properties.input.properties.address.required, undefined);
	});
});
