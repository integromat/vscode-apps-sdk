import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import proxyquire from 'proxyquire';
import type * as vscode from 'vscode';

/**
 * Regression coverage for `fetchEndpoints`'s URL construction. This used to guard against an API-version
 * vs. app-major-version mixup (`Core.pathDeterminer` took an API-version argument that was easy to
 * confuse with the app's own major version parsed out of the temp file path); that class of bug is now
 * structurally impossible since `pathDeterminer` dropped its version argument and always returns its
 * fixed v2 segment names (`sdk`, `apps`, `endpoints`, ...). What's left to protect is `parseAppAndVersion`:
 * it must still pull the app's own major version out of the temp file path and place it correctly in the
 * URL's version segment.
 */
function loadModuleWithMockedCore(rpGet: (url: string, ...rest: unknown[]) => Promise<unknown>) {
	return proxyquire('./imljson-schema-associations', {
		'../Core': { rpGet },
	}) as typeof import('./imljson-schema-associations');
}

function createEditorForFile(fileName: string): vscode.TextEditor {
	return { document: { fileName } } as unknown as vscode.TextEditor;
}

suite('ImljsonSchemaAssociations', () => {
	test("fetches endpoints using the app's own major version parsed from the temp file path", async () => {
		let requestedUrl: string | undefined;
		const mod = loadModuleWithMockedCore(async (url: string) => {
			requestedUrl = url;
			return { appEndpoints: [{ name: 'list-things' }] };
		});

		const sentNotifications: unknown[] = [];
		const associations = new mod.ImljsonSchemaAssociations({
			client: {
				sendNotification: async (_type: unknown, payload: unknown) => sentNotifications.push(payload),
			} as any,
			authorization: 'Token test',
			// The app in the file path below is major version 1 — it must land in the URL's version
			// segment as-is, not get conflated with anything else `pathDeterminer` produces.
			environment: { baseUrl: 'https://example.make.com/v2' },
		});

		await associations.handleActiveEditorChange(
			createEditorForFile('/tmp/xyz/apps-sdk/sdk/apps/demo-app/1/modules/get-things/api.imljson'),
		);

		assert.strictEqual(requestedUrl, 'https://example.make.com/v2/sdk/apps/demo-app/1/endpoints');
		assert.strictEqual(sentNotifications.length, 1);
	});

	test('never fetches for a connection/webhook api.imljson (no version segment in its temp path)', async () => {
		let fetchCalled = false;
		const mod = loadModuleWithMockedCore(async () => {
			fetchCalled = true;
			return { appEndpoints: [] };
		});

		const associations = new mod.ImljsonSchemaAssociations({
			client: { sendNotification: async () => undefined } as any,
			authorization: 'Token test',
			environment: { baseUrl: 'https://example.make.com/v2' },
		});

		// Connections/webhooks are non-versionable (`Core.isVersionable`), so their temp paths have no
		// numeric version segment — `parseAppAndVersion` must reject this rather than misreading
		// "connections" as the app's version.
		await associations.handleActiveEditorChange(
			createEditorForFile('/tmp/xyz/apps-sdk/sdk/apps/demo-app/connections/my-conn/api.imljson'),
		);

		assert.strictEqual(fetchCalled, false);
	});
});
