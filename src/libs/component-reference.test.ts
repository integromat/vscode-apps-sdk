import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { detectReferenceAt, parseOnlineAppContext } from './component-reference';

suite('component-reference detectReferenceAt()', () => {
	test('Detects an rpc:// reference when the cursor is over it', () => {
		const line = '\t\t"url": "rpc://getVendors"';
		const column = line.indexOf('getVendors');
		assert.deepStrictEqual(detectReferenceAt(line, column), {
			kind: 'rpc',
			name: 'getVendors',
			startColumn: line.indexOf('rpc://'),
			endColumn: line.indexOf('getVendors') + 'getVendors'.length,
		});
	});

	test('rpc hover range spans the whole rpc:// token including the prefix', () => {
		const line = 'value rpc://My-Rpc_1 end';
		const result = detectReferenceAt(line, line.indexOf('My-Rpc_1'));
		assert.strictEqual(result?.startColumn, line.indexOf('rpc://'), 'starts at rpc://');
		assert.strictEqual(result?.endColumn, line.indexOf('My-Rpc_1') + 'My-Rpc_1'.length, 'ends after the name');
	});

	test('Does not match one character past the end of the token (half-open range)', () => {
		const line = 'rpc://Vendors next';
		const end = line.indexOf('Vendors') + 'Vendors'.length;
		assert.strictEqual(detectReferenceAt(line, end), undefined, 'column === endColumn is outside the range');
	});

	test('Detects a function call and excludes the opening parenthesis from the range', () => {
		const line = '{{ getTimeActivityBody(parameters) }}';
		const start = line.indexOf('getTimeActivityBody');
		assert.deepStrictEqual(detectReferenceAt(line, start + 3), {
			kind: 'function',
			name: 'getTimeActivityBody',
			startColumn: start,
			endColumn: start + 'getTimeActivityBody'.length,
		});
	});

	test('iml-templates scope ignores function calls outside {{ }}', () => {
		const line = '"url": "helper(x)", "expr": "{{ helper(x) }}"';
		const outside = line.indexOf('helper');
		const inside = line.lastIndexOf('helper');
		assert.strictEqual(
			detectReferenceAt(line, outside, { functionScope: 'iml-templates' }),
			undefined,
			'outside template is ignored',
		);
		assert.strictEqual(
			detectReferenceAt(line, inside, { functionScope: 'iml-templates' })?.name,
			'helper',
			'inside template is detected',
		);
	});

	test('anywhere scope still detects function calls outside {{ }}', () => {
		const line = 'const x = helper(1);';
		const start = line.indexOf('helper');
		assert.strictEqual(detectReferenceAt(line, start, { functionScope: 'anywhere' })?.name, 'helper');
	});

	test('Returns undefined when the cursor is not over any reference', () => {
		assert.strictEqual(detectReferenceAt('"label": "Plain text value"', 5), undefined);
	});

	test('rpc references take precedence over the function-call pattern on the same line', () => {
		const line = 'rpc://Vendors and helper(';
		const result = detectReferenceAt(line, 2);
		assert.strictEqual(result?.kind, 'rpc', 'cursor inside rpc token resolves to rpc');
		assert.strictEqual(result?.name, 'Vendors');
	});
});

suite('component-reference parseOnlineAppContext()', () => {
	test('Parses app name and version from an online temp path', () => {
		const fsPath = '/tmp/abc/apps-sdk/sdk/apps/my-app/2/rpcs/getVendors/api.imljson';
		assert.deepStrictEqual(parseOnlineAppContext(fsPath), { appName: 'my-app', version: 2 });
	});

	test('Handles Windows backslash separators', () => {
		const fsPath = 'C:\\Temp\\abc\\apps-sdk\\sdk\\apps\\my-app\\3\\functions\\fn\\code.js';
		assert.deepStrictEqual(parseOnlineAppContext(fsPath), { appName: 'my-app', version: 3 });
	});

	test('Returns undefined for a non-app path', () => {
		assert.strictEqual(parseOnlineAppContext('/home/user/project/src/index.ts'), undefined);
	});

	test('Returns undefined when the version segment is not numeric', () => {
		const fsPath = '/tmp/abc/apps-sdk/sdk/apps/my-app/base.imljson';
		assert.strictEqual(parseOnlineAppContext(fsPath), undefined);
	});
});
