import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { getAppComponentCodeDefinition, getAppComponentTypes } from './component-code-def';

suite('component-code-def: endpoint', () => {
	test('endpoint defines the 4 sections with the correct API code types', () => {
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'communication').apiCodeType, 'api');
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'scope').apiCodeType, 'scope');
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'inputParameters').apiCodeType, 'inputParameters');
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'outputParameters').apiCodeType, 'outputParameters');
	});

	test('endpoint input/output params carry the snake_case checksumKey bridge', () => {
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'inputParameters').checksumKey, 'input_parameters');
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'outputParameters').checksumKey, 'output_parameters');
		// `api`/`scope` need no bridge — apiCodeType already matches the checksum column.
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'communication').checksumKey, undefined);
		assert.strictEqual(getAppComponentCodeDefinition('endpoint', 'scope').checksumKey, undefined);
	});

	test('endpoint is deployed right after connection (so its connection references already exist)', () => {
		const order = getAppComponentTypes();
		assert.ok(
			order.indexOf('connection') < order.indexOf('endpoint'),
			'connection must be deployed before endpoint',
		);
	});

	test('endpoint `context` is a metadata-backed markdown source file', () => {
		const contextDef = getAppComponentCodeDefinition('endpoint', 'context');
		assert.strictEqual(contextDef.metadataBacked, true, 'context is metadata-backed (no section route)');
		assert.strictEqual(contextDef.apiCodeType, 'context', 'apiCodeType names the endpoint metadata field');
		assert.strictEqual(contextDef.checksumKey, 'context', 'compared against the `context` checksum column');
		assert.strictEqual(contextDef.fileext, 'md', 'editable as a markdown source file');
		assert.strictEqual(contextDef.mimetype, 'text/markdown');
	});
});
