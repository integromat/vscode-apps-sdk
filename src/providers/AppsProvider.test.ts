import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { AppsProvider } from './AppsProvider';

/**
 * Unit coverage for the search-filter state on the Custom apps tree provider.
 * Verifies the filter getter/setter/clear behavior and that mutating the filter
 * triggers a tree refresh (`onDidChangeTreeData`), preventing regressions in the
 * search feature without requiring a live Make environment.
 */
suite('AppsProvider search filter', () => {
	const environment = { baseUrl: 'https://example.com', version: 2 } as any;

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
