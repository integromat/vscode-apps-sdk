import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { migrateMakecomappJsonFile } from './makecomappjson-migrations';
import type { MakecomappJson } from './types/makecomapp.types';

suite('migrateMakecomappJsonFile()', () => {
	/*
	 * Backward compatibility: a `makecomapp.json` cloned before the `endpoint` component type existed
	 * has `components`/`idMapping` with only the original 5 keys (no `endpoint`). Several mapping
	 * accessors do `idMapping?.[type].filter(...)` (guarding only `idMapping`, not the key), so a missing
	 * `endpoint` key would crash on pull/deploy. The migration must backfill it.
	 */
	test('backfills the missing `endpoint` key in components and idMapping', () => {
		const oldShape = {
			fileVersion: 1,
			generalCodeFiles: { base: null, common: null, readme: null, groups: null },
			components: {
				connection: {},
				webhook: {},
				module: {},
				rpc: {},
				function: {},
				// no `endpoint` key — pre-dates the feature
			},
			origins: [
				{
					label: 'Origin',
					baseUrl: 'https://example.make.com/api',
					appId: 'my-app',
					appVersion: 1,
					apikeyFile: '.secrets/apikey',
					idMapping: {
						connection: [],
						webhook: [],
						module: [],
						rpc: [],
						function: [],
						// no `endpoint` key
					},
				},
			],
		} as unknown as MakecomappJson;

		const { changesApplied, makecomappJson } = migrateMakecomappJsonFile(oldShape);

		assert.strictEqual(changesApplied, true, 'migration should report a change');
		assert.deepStrictEqual(makecomappJson.components.endpoint, {}, 'components.endpoint backfilled');
		assert.deepStrictEqual(
			makecomappJson.origins[0].idMapping?.endpoint,
			[],
			'origin idMapping.endpoint backfilled',
		);
	});

	test('is a no-op (no changes) when all current component types are already present', () => {
		const current = {
			fileVersion: 1,
			generalCodeFiles: { base: null, common: null, readme: null, groups: null },
			components: { connection: {}, webhook: {}, module: {}, rpc: {}, function: {}, endpoint: {} },
			origins: [
				{
					label: 'Origin',
					baseUrl: 'https://example.make.com/api',
					appId: 'my-app',
					appVersion: 1,
					apikeyFile: '.secrets/apikey',
					idMapping: { connection: [], webhook: [], module: [], rpc: [], function: [], endpoint: [] },
				},
			],
		} as unknown as MakecomappJson;

		const { changesApplied } = migrateMakecomappJsonFile(current);
		assert.strictEqual(changesApplied, false, 'no migration needed when already up to date');
	});
});
