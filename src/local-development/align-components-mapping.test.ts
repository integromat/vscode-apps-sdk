import * as assert from 'node:assert';
import { describe, test } from 'mocha';
import proxyquire from 'proxyquire';
import type { Checksum } from './types/checksum.types';
import type {
	AppComponentMetadataWithCodeFiles,
	LocalAppOriginWithSecret,
	MakecomappJson,
} from './types/makecomapp.types';

// ─── Test data factories ───

const dummyUri = { fsPath: '/test/project', scheme: 'file' } as any;

function createComponentMetadata(label = 'Test'): AppComponentMetadataWithCodeFiles {
	return { label, codeFiles: {} } as AppComponentMetadataWithCodeFiles;
}

function createOrigin(idMapping?: MakecomappJson['origins'][0]['idMapping']): LocalAppOriginWithSecret {
	return {
		baseUrl: 'https://test.make.com/api',
		appId: 'test-app',
		appVersion: 1,
		apikeyFile: '.secrets/apikey',
		apikey: 'test-key',
		idMapping: idMapping ?? { connection: [], webhook: [], module: [], rpc: [], function: [] },
	};
}

function createEmptyChecksums(): Checksum {
	return { accounts: [], hooks: [], modules: [], rpcs: [], functions: [], app: [] };
}

function createMakecomappJson(
	components?: Partial<MakecomappJson['components']>,
	origins?: MakecomappJson['origins'],
): MakecomappJson {
	return {
		fileVersion: 1,
		generalCodeFiles: { base: null, common: null, readme: null, groups: null },
		components: {
			connection: {},
			webhook: {},
			module: {},
			rpc: {},
			function: {},
			...components,
		},
		origins: origins ?? [],
	};
}

// ─── Call tracker ───

interface TrackedFn {
	(...args: any[]): any;
	calls: any[][];
}

function trackCalls(fn?: (...args: any[]) => any): TrackedFn {
	const calls: any[][] = [];
	const tracked = ((...args: any[]) => {
		calls.push(args);
		return fn?.(...args);
	}) as TrackedFn;
	tracked.calls = calls;
	return tracked;
}

// ─── Module loader with mocks ───

function loadModule(mockOverrides: Record<string, any> = {}) {
	const removeByRemoteNameCalls: any[][] = [];
	const saveChangesCalls: any[][] = [];

	const defaults: Record<string, any> = {
		getRemoteComponent: async () => ({ label: 'Mock' }),
		deleteOriginComponent: async () => { /* noop */ },
		addComponentIdMapping: async () => { /* noop */ },
		askForSelectMappedComponent: async () => Symbol('mock'),
		createRemoteAppComponent: async () => 'newRemoteName',
		createLocalEmptyComponent: async () => ({ componentLocalId: 'newLocal' }),
		convertComponentMetadataRemoteNamesToLocalIds: async () => ({}),
		showQuickPick: async () => ({ action: 'unlink' as const }),
		log: () => { /* noop */ },
		progresDialogReport: () => { /* noop */ },
	};

	const m = { ...defaults, ...mockOverrides };

	// Build makecomappJsonFile mock
	const makecomappJsonFile = m.makecomappJsonFile ?? {
		content: m.makecomappJson ?? createMakecomappJson(),
		saveChanges: async () => {
			saveChangesCalls.push([]);
		},
		getComponentIdMappingHelper: () => ({
			removeByRemoteName: (...args: any[]) => {
				removeByRemoteNameCalls.push(args);
			},
			getRemoteName: m.getRemoteName ?? (() => undefined),
		}),
	};

	const mod = proxyquire('./align-components-mapping', {
		'./remote-components-summary': {
			getRemoteComponent: m.getRemoteComponent,
			convertComponentMetadataRemoteNamesToLocalIds: m.convertComponentMetadataRemoteNamesToLocalIds,
			'@noCallThru': true,
		},
		'./delete-origin-component': {
			deleteOriginComponent: m.deleteOriginComponent,
			'@noCallThru': true,
		},
		'./makecomappjson': {
			addComponentIdMapping: m.addComponentIdMapping,
			'@noCallThru': true,
		},
		'./ask-mapped-component': {
			askForSelectMappedComponent: m.askForSelectMappedComponent,
			specialAnswers: {
				CREATE_NEW_COMPONENT: Symbol('CREATE_NEW_COMPONENT'),
				CREATE_NEW_COMPONENT__FOR_ALL: Symbol('CREATE_NEW_COMPONENT__FOR_ALL'),
				MAP_WITH_NULL: Symbol('MAP_WITH_NULL'),
				MAP_WITH_NULL__FOR_ALL: Symbol('MAP_WITH_NULL__FOR_ALL'),
			},
			'@noCallThru': true,
		},
		'./create-remote-component': {
			createRemoteAppComponent: m.createRemoteAppComponent,
			'@noCallThru': true,
		},
		'./create-local-empty-component': {
			createLocalEmptyComponent: m.createLocalEmptyComponent,
			'@noCallThru': true,
		},
		'./helpers/makecomapp-json-file-class': {
			MakecomappJsonFile: {
				fromLocalProject: async () => makecomappJsonFile,
			},
			'@noCallThru': true,
		},
		'./helpers/origin-checksum': {
			getComponentChecksumArray: (checksums: any, componentType: string) => {
				const map: Record<string, string> = {
					connection: 'accounts',
					webhook: 'hooks',
					module: 'modules',
					rpc: 'rpcs',
					function: 'functions',
					app: 'app',
				};
				return checksums[map[componentType]] ?? [];
			},
			'@noCallThru': true,
		},
		'../output-channel': {
			log: m.log,
			'@noCallThru': true,
		},
		'../utils/vscode-progress-dialog': {
			progresDialogReport: m.progresDialogReport,
			'@noCallThru': true,
		},
		'vscode': {
			window: {
				showQuickPick: m.showQuickPick,
				createOutputChannel: () => ({ appendLine: () => { /* noop */ }, show: () => { /* noop */ } }),
			},
			Uri: { file: (p: string) => ({ fsPath: p, scheme: 'file' }) },
			extensions: {
				getExtension: () => ({ packageJSON: { displayName: 'Make Apps' } }),
			},
			'@noCallThru': true,
			'@global': true,
		},
	});

	return {
		alignComponentsMapping: mod.alignComponentsMapping as typeof import('./align-components-mapping').alignComponentsMapping,
		isNotOwnedByApp: mod.isNotOwnedByApp as typeof import('./align-components-mapping').isNotOwnedByApp,
		removeByRemoteNameCalls,
		saveChangesCalls,
	};
}

// ─── Tests ───

describe('isNotOwnedByApp()', () => {
	// Loaded via loadModule() with proxyquire, not directly from the module,
	// because align-components-mapping.ts imports 'vscode' at top level
	// and that import fails outside of VSCode runtime.
	const { isNotOwnedByApp } = loadModule();

	// Connection "connA" exists in checksums without `external` flag → app owns it.
	test('returns false for connection owned by app', () => {
		const checksums = createEmptyChecksums();
		checksums.accounts = [{ name: 'connA', checksum: {} }];
		assert.strictEqual(isNotOwnedByApp('connA', 'connection', checksums), false);
	});

	// Connection "connA" has `external: true` in checksums → belongs to a different app version,
	// our app doesn't own it.
	test('returns true for external connection', () => {
		const checksums = createEmptyChecksums();
		checksums.accounts = [{ name: 'connA', checksum: {}, external: true }];
		assert.strictEqual(isNotOwnedByApp('connA', 'connection', checksums), true);
	});

	// Same as connection — webhooks can also be non-owned (shared from another app version).
	test('returns true for external webhook', () => {
		const checksums = createEmptyChecksums();
		checksums.hooks = [{ name: 'hookA', checksum: {}, external: true }];
		assert.strictEqual(isNotOwnedByApp('hookA', 'webhook', checksums), true);
	});

	// Modules cannot be non-owned — only connections and webhooks support external ownership.
	// Even if a module has `external: true`, it should still return false.
	test('returns false for module (always owned)', () => {
		const checksums = createEmptyChecksums();
		checksums.modules = [{ name: 'modA', checksum: {} }];
		assert.strictEqual(isNotOwnedByApp('modA', 'module', checksums), false);
	});
});

describe('alignComponentsMapping()', () => {
	describe('fully synced state', () => {
		/*
		 * Initial state: Local components (connA, modA) have idMapping entries and both
		 *   exist in Make (present in checksums). Everything is in sync.
		 * Align resolves: Nothing — no dialogs, no creates, no deletes.
		 */
		test('does nothing when all components are mapped and present in checksums', async () => {
			const deleteOriginComponent = trackCalls(async () => { /* noop */ });
			const addComponentIdMapping = trackCalls(async () => { /* noop */ });
			const showQuickPick = trackCalls();

			const origin = createOrigin({
				connection: [{ local: 'connA', remote: 'connA' }],
				webhook: [],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			});

			const checksums = createEmptyChecksums();
			checksums.accounts = [{ name: 'connA', checksum: {} }];
			checksums.modules = [{ name: 'modA', checksum: {} }];

			const makecomappJson = createMakecomappJson(
				{
					connection: { connA: createComponentMetadata('Connection A') },
					module: { modA: createComponentMetadata('Module A') },
				},
				[origin],
			);

			const { alignComponentsMapping } = loadModule({
				deleteOriginComponent,
				addComponentIdMapping,
				showQuickPick,
				makecomappJson,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'ignore');

			assert.strictEqual(deleteOriginComponent.calls.length, 0, 'should not delete any component');
			assert.strictEqual(addComponentIdMapping.calls.length, 0, 'should not add any mapping');
			assert.strictEqual(showQuickPick.calls.length, 0, 'should not show any dialog');
		});
	});

	describe('remoteOnly detection', () => {
		/*
		 * Initial state: Connection "connA" exists in Make (present in checksums), but has
		 *   no idMapping entry and no local component. E.g. created directly in Make UI.
		 * Align resolves: With newRemoteComponentResolution='ignore' — skips it, creates nothing.
		 */
		test('ignores remote-only components when newRemoteComponentResolution=ignore', async () => {
			const addComponentIdMapping = trackCalls(async () => { /* noop */ });
			const createLocalEmptyComponent = trackCalls(async () => ({ componentLocalId: 'newLocal' }));

			const origin = createOrigin(); // no mappings

			const checksums = createEmptyChecksums();
			checksums.accounts = [{ name: 'connA', checksum: {} }]; // exists in remote, not in mapping

			const { alignComponentsMapping } = loadModule({
				addComponentIdMapping,
				createLocalEmptyComponent,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'ignore');

			assert.strictEqual(createLocalEmptyComponent.calls.length, 0, 'should not create local component');
			assert.strictEqual(addComponentIdMapping.calls.length, 0, 'should not add mapping');
		});

		/*
		 * Initial state: Connection "connA" exists in Make (present in checksums), but has
		 *   no idMapping entry and no local component. E.g. created directly in Make UI.
		 * Align resolves: With newRemoteComponentResolution='cloneAsNew' — creates a local
		 *   empty component and adds an idMapping entry pairing the new local ID with the remote name.
		 */
		test('creates local component when newRemoteComponentResolution=cloneAsNew', async () => {
			const addComponentIdMapping = trackCalls(async () => { /* noop */ });
			const createLocalEmptyComponent = trackCalls(async () => ({ componentLocalId: 'connA' }));

			const origin = createOrigin(); // no mappings

			const checksums = createEmptyChecksums();
			checksums.accounts = [{ name: 'connA', checksum: {} }];

			const { alignComponentsMapping } = loadModule({
				addComponentIdMapping,
				createLocalEmptyComponent,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'cloneAsNew');

			assert.strictEqual(createLocalEmptyComponent.calls.length, 1, 'should create one local component');
			assert.strictEqual(addComponentIdMapping.calls.length, 1, 'should add one mapping');
		});

		/*
		 * Initial state: Connection "connA" exists in Make (present in checksums) and has
		 *   an idMapping entry {local: null, remote: "connA"} — deliberately ignored by the developer.
		 * Align resolves: Nothing — the mapping with local=null means "I know about this remote
		 *   component but I don't want a local counterpart". It must NOT appear as remoteOnly.
		 */
		test('does not treat deliberately ignored remote component as remoteOnly', async () => {
			const createLocalEmptyComponent = trackCalls(async () => ({ componentLocalId: 'connA' }));
			const addComponentIdMapping = trackCalls(async () => { /* noop */ });

			const origin = createOrigin({
				connection: [{ local: null, remote: 'connA' }],
				webhook: [],
				module: [],
				rpc: [],
				function: [],
			});

			const checksums = createEmptyChecksums();
			checksums.accounts = [{ name: 'connA', checksum: {} }];

			const { alignComponentsMapping } = loadModule({
				createLocalEmptyComponent,
				addComponentIdMapping,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'cloneAsNew');

			assert.strictEqual(createLocalEmptyComponent.calls.length, 0, 'should not clone ignored component');
			assert.strictEqual(addComponentIdMapping.calls.length, 0, 'should not add mapping');
		});
	});

	describe('localOnly detection', () => {
		/*
		 * Initial state: Connection "connA" exists locally (in makecomapp.json components),
		 *   but has no idMapping entry and does not exist in Make (not in checksums).
		 * Align resolves: With newLocalComponentResolution='ignore' — skips it,
		 *   no remote component created, no user prompt, no mapping added.
		 */
		test('ignores local-only components when newLocalComponentResolution=ignore', async () => {
			const addComponentIdMapping = trackCalls(async () => { /* noop */ });
			const createRemoteAppComponent = trackCalls(async () => 'newRemote');
			const askForSelectMappedComponent = trackCalls();

			const origin = createOrigin(); // no mappings

			const checksums = createEmptyChecksums(); // nothing in remote

			const makecomappJson = createMakecomappJson(
				{ connection: { connA: createComponentMetadata('Connection A') } },
				[origin],
			);

			const { alignComponentsMapping } = loadModule({
				addComponentIdMapping,
				createRemoteAppComponent,
				askForSelectMappedComponent,
				makecomappJson,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'ignore');

			assert.strictEqual(createRemoteAppComponent.calls.length, 0, 'should not create remote component');
			assert.strictEqual(askForSelectMappedComponent.calls.length, 0, 'should not ask user');
			assert.strictEqual(addComponentIdMapping.calls.length, 0, 'should not add mapping');
		});

		/*
		 * Initial state: Connection "connA" exists locally (in makecomapp.json components) and has
		 *   an idMapping entry {local: "connA", remote: null} — it was created locally and is
		 *   waiting for its first deploy. It does not exist in Make yet (not in checksums).
		 * Align resolves: Nothing — the mapping with remote=null means "pending first deploy".
		 *   getRemoteName() returns null (not undefined), so it must NOT appear as localOnly.
		 */
		test('does not treat pending-deploy component as localOnly', async () => {
			const createRemoteAppComponent = trackCalls(async () => 'newRemote');
			const askForSelectMappedComponent = trackCalls();

			const origin = createOrigin({
				connection: [{ local: 'connA', remote: null }],
				webhook: [],
				module: [],
				rpc: [],
				function: [],
			});

			const checksums = createEmptyChecksums();

			const makecomappJson = createMakecomappJson(
				{ connection: { connA: createComponentMetadata('Connection A') } },
				[origin],
			);

			const { alignComponentsMapping } = loadModule({
				createRemoteAppComponent,
				askForSelectMappedComponent,
				makecomappJson,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'askUser', 'ignore');

			assert.strictEqual(createRemoteAppComponent.calls.length, 0, 'should not create remote component');
			assert.strictEqual(askForSelectMappedComponent.calls.length, 0, 'should not ask user about pending component');
		});
	});

	describe('deletedLocally', () => {
		/*
		 * Initial state: Connection "connA" has idMapping with localDeleted: true flag,
		 *   meaning the developer deleted it locally. The remote component still exists in Make
		 *   (present in checksums).
		 * Align resolves: Deletes the remote component via API, removes the idMapping entry,
		 *   saves changes to makecomapp.json.
		 */
		test('deletes remote component when mapping has localDeleted=true', async () => {
			const deleteOriginComponent = trackCalls(async () => { /* noop */ });

			const origin = createOrigin({
				connection: [{ local: 'connA', remote: 'connA', localDeleted: true }],
				webhook: [],
				module: [],
				rpc: [],
				function: [],
			});

			const checksums = createEmptyChecksums();
			checksums.accounts = [{ name: 'connA', checksum: {} }]; // still in remote

			const { alignComponentsMapping, removeByRemoteNameCalls, saveChangesCalls } = loadModule({
				deleteOriginComponent,
			});

			await alignComponentsMapping(dummyUri, origin, checksums, 'ignore', 'ignore');

			assert.strictEqual(deleteOriginComponent.calls.length, 1, 'should delete one remote component');
			assert.strictEqual(deleteOriginComponent.calls[0][1], 'connection', 'should delete a connection');
			assert.strictEqual(deleteOriginComponent.calls[0][2], 'connA', 'should delete connA');
			assert.strictEqual(removeByRemoteNameCalls.length, 1, 'should remove mapping');
			assert.strictEqual(saveChangesCalls.length, 1, 'should save changes');
		});
	});
});
