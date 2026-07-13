import * as assert from 'node:assert';
import { suite, test } from 'mocha';
import proxyquire from 'proxyquire';
import type * as vscode from 'vscode';

/**
 * Regression coverage for the app-major-version vs. API-version mixup: `Core.pathDeterminer` must be
 * called with the *API* version (always 2 here, per the `environment.version !== 2` guard), not the
 * app's own major version parsed out of the temp file path — otherwise the fetch URL degenerates to the
 * v1 shape for any app whose major version isn't coincidentally 2 (e.g. every version-1 app).
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
	test("fetches endpoints using the API version, not the app's own major version", async () => {
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
			// The app in the file path below is major version 1 — a real app on API v2 whose own
			// version number happens to differ from the API version (the bug's exact failure case).
			environment: { baseUrl: 'https://example.make.com/v2', version: 2 },
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
			environment: { baseUrl: 'https://example.make.com/v2', version: 2 },
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
