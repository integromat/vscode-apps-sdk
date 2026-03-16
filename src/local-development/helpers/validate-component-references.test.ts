import * as assert from 'node:assert';
import { describe, test } from 'mocha';
import type { MakecomappJson } from '../types/makecomapp.types';
import type { AppComponentType } from '../../types/app-component-type.types';
import { validateComponentReferences } from './validate-component-references';

// ─── Test data factories ───

function createMakecomappJson(
	components?: Partial<MakecomappJson['components']>,
	idMapping?: Record<AppComponentType, { local: string | null; remote: string | null }[]>,
): { makecomappJson: MakecomappJson; componentIdMapping: FakeMappingHelper } {
	const makecomappJson: MakecomappJson = {
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
		origins: [],
	};

	const componentIdMapping = new FakeMappingHelper(idMapping ?? {
		connection: [],
		webhook: [],
		module: [],
		rpc: [],
		function: [],
	});

	return { makecomappJson, componentIdMapping };
}

/**
 * Minimal fake of ComponentIdMappingHelper that only implements getRemoteName().
 */
class FakeMappingHelper {
	constructor(private readonly mappings: Record<string, { local: string | null; remote: string | null }[]>) {}

	getRemoteName(componentType: AppComponentType, localId: string): string | null | undefined {
		const items = this.mappings[componentType] ?? [];
		const found = items.find((item) => item.local === localId);
		if (!found) {
			return undefined; // no mapping
		}
		return found.remote; // string or null
	}
}

// ─── Tests ───

describe('validateComponentReferences()', () => {
	/*
	 * Initial state: Module "modA" references connection "connA" and webhook "hookA".
	 *   Both "connA" and "hookA" have valid idMapping entries with remote names.
	 * Validation resolves: All references resolve to valid mappings — no error thrown.
	 */
	test('passes when all references have valid mappings', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', connection: 'connA', webhook: 'hookA', codeFiles: {} } as any,
				},
			},
			{
				connection: [{ local: 'connA', remote: 'connA' }],
				webhook: [{ local: 'hookA', remote: 'hookA' }],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			},
		);

		assert.doesNotThrow(() => {
			validateComponentReferences(makecomappJson, componentIdMapping as any);
		});
	});

	/*
	 * Initial state: Module "modA" references connection "connA", but "connA"
	 *   has no idMapping entry (getRemoteName returns undefined). E.g. the connection
	 *   mapping was removed by stale mapping unlink, but the module still references it.
	 * Validation resolves: Throws error listing the broken reference:
	 *   module "modA" → connection "connA" has no mapping.
	 */
	test('throws on dangling connection reference', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', connection: 'connA', codeFiles: {} } as any,
				},
			},
			{
				connection: [], // no mapping for connA
				webhook: [],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			},
		);

		assert.throws(
			() => validateComponentReferences(makecomappJson, componentIdMapping as any),
			(err: Error) => {
				assert.ok(err.message.includes('module "modA"'), 'should mention module name');
				assert.ok(err.message.includes('connection "connA"'), 'should mention connection name');
				return true;
			},
		);
	});

	/*
	 * Initial state: RPC "rpcA" references altConnection "connB", but "connB"
	 *   has no idMapping entry (getRemoteName returns undefined).
	 * Validation resolves: Throws error listing the broken reference:
	 *   rpc "rpcA" → altConnection "connB" has no mapping.
	 */
	test('throws on dangling altConnection reference', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				rpc: {
					rpcA: { label: 'RPC A', altConnection: 'connB', codeFiles: {} } as any,
				},
			},
			{
				connection: [], // no mapping for connB
				webhook: [],
				module: [],
				rpc: [{ local: 'rpcA', remote: 'rpcA' }],
				function: [],
			},
		);

		assert.throws(
			() => validateComponentReferences(makecomappJson, componentIdMapping as any),
			(err: Error) => {
				assert.ok(err.message.includes('rpc "rpcA"'), 'should mention rpc name');
				assert.ok(err.message.includes('altConnection "connB"'), 'should mention altConnection name');
				return true;
			},
		);
	});

	/*
	 * Initial state: Module "modA" (instant_trigger) references webhook "hookA",
	 *   but "hookA" has no idMapping entry (getRemoteName returns undefined).
	 * Validation resolves: Throws error listing the broken reference:
	 *   module "modA" → webhook "hookA" has no mapping.
	 */
	test('throws on dangling webhook reference', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', webhook: 'hookA', codeFiles: {} } as any,
				},
			},
			{
				connection: [],
				webhook: [], // no mapping for hookA
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			},
		);

		assert.throws(
			() => validateComponentReferences(makecomappJson, componentIdMapping as any),
			(err: Error) => {
				assert.ok(err.message.includes('module "modA"'), 'should mention module name');
				assert.ok(err.message.includes('webhook "hookA"'), 'should mention webhook name');
				return true;
			},
		);
	});

	/*
	 * Initial state: Module "modA" has connection=null, meaning "this module
	 *   intentionally has no connection". No idMapping lookup needed.
	 * Validation resolves: Null references are skipped — no error thrown.
	 */
	test('passes when reference is null (no reference set)', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', connection: null, codeFiles: {} } as any,
				},
			},
			{
				connection: [],
				webhook: [],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			},
		);

		assert.doesNotThrow(() => {
			validateComponentReferences(makecomappJson, componentIdMapping as any);
		});
	});

	/*
	 * Initial state: Module "modA" references connection "connA". "connA" has
	 *   an idMapping entry with remote=null (getRemoteName returns null),
	 *   meaning "I know about this component but it's deliberately ignored".
	 * Validation resolves: Ignored mappings (remote=null) are acceptable — no error thrown.
	 */
	test('passes when referenced component mapping is explicitly ignored (remote=null)', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', connection: 'connA', codeFiles: {} } as any,
				},
			},
			{
				connection: [{ local: 'connA', remote: null }], // explicitly ignored
				webhook: [],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [],
				function: [],
			},
		);

		assert.doesNotThrow(() => {
			validateComponentReferences(makecomappJson, componentIdMapping as any);
		});
	});

	/*
	 * Initial state: Module "modA" references connection "connA" (no mapping) and
	 *   RPC "rpcA" references altConnection "connB" (no mapping). Two independent
	 *   broken references across different components.
	 * Validation resolves: Throws a single error listing BOTH violations,
	 *   so the user can fix all issues at once instead of fixing one at a time.
	 */
	test('collects multiple violations into a single error', () => {
		const { makecomappJson, componentIdMapping } = createMakecomappJson(
			{
				module: {
					modA: { label: 'Module A', connection: 'connA', codeFiles: {} } as any,
				},
				rpc: {
					rpcA: { label: 'RPC A', altConnection: 'connB', codeFiles: {} } as any,
				},
			},
			{
				connection: [], // no mappings for connA or connB
				webhook: [],
				module: [{ local: 'modA', remote: 'modA' }],
				rpc: [{ local: 'rpcA', remote: 'rpcA' }],
				function: [],
			},
		);

		assert.throws(
			() => validateComponentReferences(makecomappJson, componentIdMapping as any),
			(err: Error) => {
				assert.ok(err.message.includes('module "modA"'), 'should mention module');
				assert.ok(err.message.includes('connection "connA"'), 'should mention connA');
				assert.ok(err.message.includes('rpc "rpcA"'), 'should mention rpc');
				assert.ok(err.message.includes('altConnection "connB"'), 'should mention connB');
				return true;
			},
		);
	});
});
