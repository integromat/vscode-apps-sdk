import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import { getApiBodyForComponentMetadataDeploy } from './deploy-metadata';
import type { AppComponentMetadata, LocalAppOriginWithSecret, MakecomappJson } from './types/makecomapp.types';

function buildFixture(): { makecomappJson: MakecomappJson; origin: LocalAppOriginWithSecret } {
	const origin: LocalAppOriginWithSecret = {
		label: 'Origin',
		baseUrl: 'https://example.make.com/api',
		appId: 'my-app',
		appVersion: 1,
		apikeyFile: '.secrets/apikey',
		apikey: 'secret',
		idMapping: {
			connection: [
				{ local: 'connA', remote: 'remoteConnA' },
				{ local: 'connB', remote: 'remoteConnB' },
			],
			webhook: [],
			module: [],
			rpc: [],
			function: [],
			endpoint: [{ local: 'epA', remote: 'epA' }],
		},
	};
	const makecomappJson: MakecomappJson = {
		fileVersion: 1,
		generalCodeFiles: { base: null, common: null, readme: null, groups: null },
		components: { connection: {}, webhook: {}, module: {}, rpc: {}, function: {}, endpoint: {} },
		origins: [origin],
	};
	return { makecomappJson, origin };
}

suite('getApiBodyForComponentMetadataDeploy: endpoint', () => {
	test('builds the endpoint PATCH/POST body and translates attachedAccounts (local IDs → remote names)', () => {
		const { makecomappJson, origin } = buildFixture();
		const metadata: AppComponentMetadata = {
			label: 'Get Entity',
			description: 'Retrieves the entity.',
			annotations: { readOnlyHint: true, idempotentHint: true },
			attachedAccounts: ['connA', 'connB'],
		} as AppComponentMetadata;

		const body = getApiBodyForComponentMetadataDeploy('endpoint', metadata, makecomappJson, origin);

		assert.strictEqual(body.label, 'Get Entity');
		assert.strictEqual(body.description, 'Retrieves the entity.');
		assert.deepStrictEqual(body.annotations, { readOnlyHint: true, idempotentHint: true });
		// Connection references are translated from local IDs to remote names.
		assert.deepStrictEqual(body.attachedAccounts, ['remoteConnA', 'remoteConnB']);
		// `context` is NOT a metadata field — it is a metadata-backed source code file (deployed separately).
		assert.strictEqual(body.context, undefined);
	});

	test('drops unresolved/ignored connections from attachedAccounts', () => {
		const { makecomappJson, origin } = buildFixture();
		// "connIgnored" is mapped to remote=null (explicitly ignored) → should be dropped from the deployed list.
		origin.idMapping?.connection.push({ local: 'connIgnored', remote: null });
		const metadata: AppComponentMetadata = {
			label: 'Get Entity',
			attachedAccounts: ['connA', 'connIgnored'],
		} as AppComponentMetadata;

		const body = getApiBodyForComponentMetadataDeploy('endpoint', metadata, makecomappJson, origin);

		assert.deepStrictEqual(body.attachedAccounts, ['remoteConnA']);
	});
});
