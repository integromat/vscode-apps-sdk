import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import {
	getAppComponentCodeDefinition,
	getAppComponentTypes,
	getGeneralCodeDefinition,
	resolveCodeFileExtension,
} from './component-code-def';

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

suite('component-code-def: resolveCodeFileExtension', () => {
	const imljsonCodeDef = getAppComponentCodeDefinition('module', 'communication');

	test('IMLJSON codes keep `iml.json` by default', () => {
		assert.strictEqual(resolveCodeFileExtension(imljsonCodeDef, 'json'), 'iml.json');
	});

	test('IMLJSON codes switch to `iml.jsonc` when the user opted in', () => {
		assert.strictEqual(resolveCodeFileExtension(imljsonCodeDef, 'jsonc'), 'iml.jsonc');
	});

	test('non-IMLJSON codes are never affected', () => {
		// Plain JSON data files must stay strict JSON — the API rejects comments in them.
		const plainJsonDef = getGeneralCodeDefinition('groups');
		const markdownDef = getGeneralCodeDefinition('readme');
		const javascriptDef = getAppComponentCodeDefinition('function', 'code');

		for (const jsoncFileExtension of ['json', 'jsonc'] as const) {
			assert.strictEqual(resolveCodeFileExtension(plainJsonDef, jsoncFileExtension), 'json');
			assert.strictEqual(resolveCodeFileExtension(markdownDef, jsoncFileExtension), 'md');
			assert.strictEqual(resolveCodeFileExtension(javascriptDef, jsoncFileExtension), 'js');
		}
	});
});
