import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import App from '../tree/App';
import {
	buildComponentTreeItem,
	toComponentSummary,
	unwrapComponentsResponse,
	type AppComponentSummary,
} from './app-component-search';

/**
 * Locks the deterministic tree-id contract that `TreeView.reveal` relies on: a rebuilt
 * component node must carry the exact ids `AppsProvider.getChildren` would produce, namely
 * `<app.id>_<plural>_<name>` for the Item and `<app.id>_<plural>` for its parent Group.
 */
suite('app-component-search buildComponentTreeItem()', () => {
	const app = new (App as any)('myApp', 'My App', 'desc', 2, false, false, 'light', [], 0);
	const summary: AppComponentSummary = {
		name: 'getData',
		label: 'Get Data',
		supertype: 'module',
		groupPlural: 'modules',
		type: 4,
		public: false,
		approved: false,
		description: 'Fetches data',
		crud: undefined,
	};

	test('Builds an Item whose id and parent Group id match the lazy tree', () => {
		const item = buildComponentTreeItem(app, summary);
		assert.strictEqual(item.id, 'myApp@2_modules_getData', 'Item id matches <app.id>_<plural>_<name>');
		assert.strictEqual(item.parent.id, 'myApp@2_modules', 'Group id matches <app.id>_<plural>');
		assert.strictEqual(item.parent.parent, app, 'Group parent is the real App node');
	});

	test('Preserves the component identity on the rebuilt node', () => {
		const item = buildComponentTreeItem(app, summary);
		assert.strictEqual(item.name, 'getData', 'name carried through');
		assert.strictEqual(item.supertype, 'module', 'supertype carried through');
	});
});

/**
 * Coverage for the regression-prone parsing logic: v1 vs v2 response unwrapping.
 */
suite('app-component-search unwrapComponentsResponse()', () => {
	test('v1 returns the response array directly', () => {
		const input = [{ name: 'a' }, { name: 'b' }];
		assert.deepStrictEqual(unwrapComponentsResponse(input, 'modules', 1), input);
	});

	test('v2 unwraps the appModules property', () => {
		const input = { appModules: [{ name: 'a' }] };
		assert.deepStrictEqual(unwrapComponentsResponse(input, 'modules', 2), [{ name: 'a' }]);
	});

	test('v2 unwraps the appRpcs property', () => {
		const input = { appRpcs: [{ name: 'r' }] };
		assert.deepStrictEqual(unwrapComponentsResponse(input, 'rpcs', 2), [{ name: 'r' }]);
	});

	test('Returns an empty array for a missing/undefined group', () => {
		assert.deepStrictEqual(unwrapComponentsResponse({}, 'functions', 2), []);
		assert.deepStrictEqual(unwrapComponentsResponse(undefined, 'functions', 2), []);
	});
});

/**
 * Coverage for the label fallback and field mapping, mirroring the tree's `Item` behavior.
 */
suite('app-component-search toComponentSummary()', () => {
	test('Uses the label when present', () => {
		const output: AppComponentSummary = {
			name: 'createContact',
			label: 'Create a Contact',
			supertype: 'module',
			groupPlural: 'modules',
			type: 4,
			public: undefined,
			approved: undefined,
			description: undefined,
			crud: 'create',
		};
		assert.deepStrictEqual(
			toComponentSummary(
				{ name: 'createContact', label: 'Create a Contact', type: 4, crud: 'create' },
				'module',
				'modules',
			),
			output,
		);
	});

	test('Falls back to name + args when the label is absent (functions)', () => {
		const result = toComponentSummary({ name: 'getTime', args: '(date)' }, 'function', 'functions');
		assert.strictEqual(result.label, 'getTime(date)', 'label is name concatenated with args');
		assert.strictEqual(result.supertype, 'function', 'supertype is function');
		assert.strictEqual(result.groupPlural, 'functions', 'groupPlural is functions');
	});

	test('Resolves the module type from type, type_id, or typeId', () => {
		// eslint-disable-next-line camelcase -- mirrors the snake_case field returned by the Make v1 API
		assert.strictEqual(toComponentSummary({ name: 'a', type_id: 9 }, 'module', 'modules').type, 9, 'type_id');
		assert.strictEqual(toComponentSummary({ name: 'a', typeId: 10 }, 'module', 'modules').type, 10, 'typeId');
	});
});
