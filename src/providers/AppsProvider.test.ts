import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { AppsProvider } from './AppsProvider';
import App from '../tree/App';

/**
 * Unit coverage for the search-filter state on the Custom apps tree provider.
 * Verifies the filter getter/setter/clear behavior and that mutating the filter
 * triggers a tree refresh (`onDidChangeTreeData`), preventing regressions in the
 * search feature without requiring a live Make environment.
 */
suite('AppsProvider search filter', () => {
	const environment = { baseUrl: 'https://example.com' } as any;

	function createProvider() {
		return new (AppsProvider as any)('Token abc', environment, '/tmp/apps-sdk-test', false);
	}

	test('Defaults to an empty filter', () => {
		const provider = createProvider();
		assert.strictEqual(provider.searchFilter, '');
	});

	test('setSearchFilter stores the trimmed term', () => {
		const provider = createProvider();
		provider.setSearchFilter('  Hello World  ');
		assert.strictEqual(provider.searchFilter, 'Hello World');
	});

	test('setSearchFilter coerces nullish input to an empty string', () => {
		const provider = createProvider();
		provider.setSearchFilter(undefined);
		assert.strictEqual(provider.searchFilter, '', 'undefined becomes empty string');
		provider.setSearchFilter('term');
		provider.setSearchFilter(null);
		assert.strictEqual(provider.searchFilter, '', 'null becomes empty string');
	});

	test('clearSearchFilter resets the filter to an empty string', () => {
		const provider = createProvider();
		provider.setSearchFilter('something');
		provider.clearSearchFilter();
		assert.strictEqual(provider.searchFilter, '');
	});

	test('setSearchFilter fires a tree refresh', () => {
		const provider = createProvider();
		let fireCount = 0;
		const subscription = provider.onDidChangeTreeData(() => {
			fireCount += 1;
		});
		provider.setSearchFilter('abc');
		subscription.dispose();
		assert.strictEqual(fireCount, 1);
	});

	test('clearSearchFilter fires a tree refresh', () => {
		const provider = createProvider();
		provider.setSearchFilter('abc');
		let fireCount = 0;
		const subscription = provider.onDidChangeTreeData(() => {
			fireCount += 1;
		});
		provider.clearSearchFilter();
		subscription.dispose();
		assert.strictEqual(fireCount, 1);
	});
});

/**
 * Unit coverage for the actual app-filtering logic (`_applySearchFilter`),
 * matching against label, name (id), and description case-insensitively.
 */
suite('AppsProvider _applySearchFilter()', () => {
	const environment = { baseUrl: 'https://example.com' } as any;

	// Real App instances so the test also guards the App shape (bareLabel/name/description)
	// that the filter depends on. Note: App defaults a missing description to '' (see src/tree/App.js).
	const apps = [
		new (App as any)('createContact', 'Create a Contact', 'Creates a new contact', 1, false, false, 'light', [], 0),
		new (App as any)('rmRecord', 'Delete a Record', 'Removes an existing record', 1, false, false, 'light', [], 0),
		new (App as any)('listUsers', 'List Users', undefined, 1, false, false, 'light', [], 0),
	];

	function filterWith(term: string) {
		const provider = new (AppsProvider as any)('Token abc', environment, '/tmp/apps-sdk-test', false);
		provider.setSearchFilter(term);
		return provider._applySearchFilter(apps).map((app: { name: string }) => app.name);
	}

	test('Returns all apps when no filter is active', () => {
		const provider = new (AppsProvider as any)('Token abc', environment, '/tmp/apps-sdk-test', false);
		assert.deepStrictEqual(provider._applySearchFilter(apps), apps);
	});

	test('Matches by label (case-insensitive)', () => {
		assert.deepStrictEqual(filterWith('contact'), ['createContact']);
	});

	test('Matches by name when it differs from the label', () => {
		assert.deepStrictEqual(filterWith('rmrecord'), ['rmRecord']);
	});

	test('Matches by description', () => {
		assert.deepStrictEqual(filterWith('removes'), ['rmRecord']);
	});

	test('Handles an empty (defaulted) description, matching via other fields', () => {
		assert.strictEqual(apps[2].description, '', 'App defaults a missing description to an empty string');
		assert.deepStrictEqual(filterWith('users'), ['listUsers']);
	});

	test('Returns an empty array when nothing matches', () => {
		assert.deepStrictEqual(filterWith('nonexistent'), []);
	});
});
