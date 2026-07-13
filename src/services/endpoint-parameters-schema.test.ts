import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { suite, test } from 'mocha';
import { buildEndpointParametersSchema } from './endpoint-parameters-schema';

function loadParametersSchema(): Record<string, unknown> {
	const schemaPath = path.join(__dirname, '../../syntaxes/imljson/schemas/parameters.json');
	return JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
}

function definitionsOf(schema: Record<string, unknown>): Record<string, Record<string, unknown>> {
	return schema.definitions as Record<string, Record<string, unknown>>;
}

suite('buildEndpointParametersSchema()', () => {
	const parametersSchema = loadParametersSchema();

	test('adds `help` to the shared `parameter` definition, and stays idempotent', () => {
		const result = buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		const required = definitionsOf(result).parameter.required as string[];
		assert.ok(required.includes('help'));
		assert.ok(required.includes('type'), 'existing required entries are preserved');

		// Feeding an already-derived schema back in must not duplicate the entry.
		const rederived = buildEndpointParametersSchema(result, 'inputSchema');
		const rederivedRequired = definitionsOf(rederived).parameter.required as string[];
		assert.strictEqual(rederivedRequired.filter((entry) => entry === 'help').length, 1);
	});

	test('removes `banner` from the type enum and strips banner-only properties, keeps others', () => {
		const result = buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		const parameter = definitionsOf(result).parameter;
		const properties = parameter.properties as Record<string, unknown>;
		const typeEnum = (properties.type as { oneOf: { enum?: string[] }[] }).oneOf[0].enum as string[];

		assert.ok(!typeEnum.includes('banner'));
		assert.ok(typeEnum.includes('text'), 'unrelated type values are preserved');

		for (const bannerProp of ['title', 'text', 'closable', 'theme', 'badge']) {
			assert.ok(!(bannerProp in properties), `"${bannerProp}" should be removed`);
		}
		for (const keptProp of ['name', 'label', 'help', 'type', 'default', 'required']) {
			assert.ok(keptProp in properties, `"${keptProp}" should be kept`);
		}
	});

	test('wires namedParameter/topLevelParameter into `parameters.items` and the root `items`', () => {
		const result = buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		const definitions = definitionsOf(result);

		assert.deepStrictEqual(definitions.namedParameter, {
			allOf: [{ $ref: '#/definitions/parameter' }, { required: ['name'] }],
		});
		assert.deepStrictEqual(definitions.parameters.items, { $ref: '#/definitions/namedParameter' });
		assert.deepStrictEqual(result.items, { $ref: '#/definitions/topLevelParameter' });

		const topLevelParameter = definitions.topLevelParameter as { allOf: unknown[] };
		assert.deepStrictEqual(topLevelParameter.allOf[0], { $ref: '#/definitions/namedParameter' });
	});

	test('constrains a top-level `json` field name to the given jsonFieldName', () => {
		const input = buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		const output = buildEndpointParametersSchema(parametersSchema, 'outputSchema');

		const inputThen = (definitionsOf(input).topLevelParameter as { allOf: { then?: unknown }[] }).allOf[1].then;
		const outputThen = (definitionsOf(output).topLevelParameter as { allOf: { then?: unknown }[] }).allOf[1].then;

		assert.deepStrictEqual(inputThen, { properties: { name: { const: 'inputSchema' } } });
		assert.deepStrictEqual(outputThen, { properties: { name: { const: 'outputSchema' } } });
	});

	test('removes every definition\'s `$id`', () => {
		const result = buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		for (const [name, definition] of Object.entries(definitionsOf(result))) {
			assert.ok(!('$id' in definition), `definitions.${name} should not carry an $id`);
		}
	});

	test('does not mutate the input schema', () => {
		const before = JSON.parse(JSON.stringify(parametersSchema));
		buildEndpointParametersSchema(parametersSchema, 'inputSchema');
		assert.deepStrictEqual(parametersSchema, before);
	});
});
