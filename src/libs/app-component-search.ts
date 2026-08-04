import camelCase from 'lodash/camelCase';
import * as Core from '../Core';
import { log } from '../output-channel';
import Group from '../tree/Group';
import Item from '../tree/Item';

/**
 * A flattened description of a single app component (connection, webhook, module,
 * RPC, function or endpoint) sufficient to display it in a Quick Pick and to rebuild
 * the matching tree node for `TreeView.reveal`.
 */
export interface AppComponentSummary {
	/** Internal component name (the API id). This is what the user searches by when it differs from the label. */
	name: string;
	/**
	 * Human-readable label: the API `label` if present, otherwise `name + args`. The fallback
	 * applies to any component type, but in practice only functions lack a `label`.
	 */
	label: string;
	/** Singular component type, e.g. `module` / `rpc` (matches `Item.supertype`). */
	supertype: string;
	/** API plural used as the tree group id, e.g. `modules` / `rpcs`. */
	groupPlural: string;
	/**
	 * Component type, mirroring `Item.type` in the tree model: a numeric type id for modules,
	 * or a string (e.g. `'oauth'`) for connections; undefined for component types without a type.
	 */
	type: number | string | undefined;
	public: boolean | undefined;
	approved: boolean | undefined;
	description: string | undefined;
	crud: string | undefined;
}

interface FetchAppComponentsOptions {
	baseUrl: string;
	authorization: string;
	appName: string;
	appVersion: number;
}

export interface AppComponentsSummaryResult {
	/** Flat list of all successfully fetched components. */
	components: AppComponentSummary[];
	/**
	 * API plural names of the component groups whose fetch failed (e.g. `['modules']`).
	 * Lets the caller distinguish a genuinely empty app from a failed load - the underlying
	 * `rpGet` already surfaces an error dialog per failed group.
	 */
	failedGroups: string[];
}

/**
 * The subset of fields the Make API returns per component that this helper reads. Everything
 * except `name` is optional because it varies by component type (e.g. only functions carry
 * `args`, only modules carry a numeric type, only connections carry a string `type`).
 */
interface RawApiComponent {
	name: string;
	label?: string;
	args?: string;
	type?: number | string;
	/** snake_case type id kept for parity with `getChildren`; the v2 API uses `typeId`. */
	type_id?: number;
	typeId?: number;
	public?: boolean;
	approved?: boolean;
	description?: string;
	crud?: string;
}

/**
 * A single pending-change record from `App.changes`. `group` is the API component group
 * (`account` / `hook` / `module` / ...), `item` the component name, `code` the code file
 * (or the synthetic `groups` marker). Only the fields this helper filters on are typed.
 */
interface AppComponentChange {
	group?: string;
	code?: string;
	item?: string;
}

/**
 * The minimal shape of the `App` tree node used as the ancestor when rebuilding a component
 * node: `TreeView.reveal` walks the `parent` chain by `id`, and the humanized "changed" marker
 * is derived from `changes`. The real `App` instance (untyped legacy JS) satisfies this.
 */
interface AppTreeNode {
	id: string;
	changes?: AppComponentChange[];
}

/** API plural names of the component groups, in the order they should be listed. */
const COMPONENT_GROUPS = ['connections', 'webhooks', 'modules', 'rpcs', 'functions', 'endpoints'] as const;

/**
 * Humanized group labels, mirroring the group labels built in `AppsProvider.getChildren`
 * (note `rpcs` -> "Remote procedures", not a title-cased plural). Used so a node rebuilt for
 * `TreeView.reveal` shows the same label/casing as the real tree.
 */
const GROUP_LABELS: Record<string, string> = {
	connections: 'Connections',
	webhooks: 'Webhooks',
	modules: 'Modules',
	rpcs: 'Remote procedures',
	functions: 'Functions',
	endpoints: 'Endpoints',
};

/**
 * Unwraps the component list from a Make API (v2) response, which nests it under
 * `app<GroupPlural>` (e.g. `appModules`). Mirrors the level-2 logic in `AppsProvider.getChildren`.
 */
export function unwrapComponentsResponse(response: unknown, groupPlural: string): RawApiComponent[] {
	const items = (response as Record<string, unknown> | null | undefined)?.[camelCase(`app_${groupPlural}`)];
	return Array.isArray(items) ? (items as RawApiComponent[]) : [];
}

/**
 * Maps a single raw API component to a flat summary, using the same label handling as the
 * tree (`Item`): a present `label` wins, otherwise it falls back to `name + args` regardless
 * of component type (in practice only functions lack a `label`).
 */
export function toComponentSummary(
	item: RawApiComponent,
	supertype: string,
	groupPlural: string,
): AppComponentSummary {
	return {
		name: item.name,
		label: item.label || `${item.name}${item.args ?? ''}`,
		supertype,
		groupPlural,
		type: item.type || item.type_id || item.typeId,
		public: item.public,
		approved: item.approved,
		description: item.description,
		crud: item.crud,
	};
}

/**
 * Fetches the components of a single app across all component types and returns the
 * flattened summaries together with the API plural names of any groups whose fetch failed.
 * Each type is fetched independently: a single failing/missing type is logged and skipped so
 * the rest still resolve, and the caller can tell a genuinely empty app from a failed load.
 *
 * Faithfully mirrors the level-2 logic in `AppsProvider.getChildren`:
 *  - connections/webhooks URIs omit the app version segment,
 *  - the response is unwrapped via `response[camelCase('app_<plural>')]`,
 *  - the label uses the same fallback as the tree (`label || name + args`),
 *  - endpoints (an opt-in feature) fail silently to an empty list when disabled.
 */
export async function fetchAppComponentsSummary(
	options: FetchAppComponentsOptions,
): Promise<AppComponentsSummaryResult> {
	const { baseUrl, authorization, appName, appVersion } = options;

	const perGroup = await Promise.all(
		COMPONENT_GROUPS.map(
			async (groupPlural): Promise<{ components: AppComponentSummary[]; failed: boolean }> => {
				const supertype = groupPlural.slice(0, -1);
				// Endpoints may be disabled on the environment; suppress the error dialog and treat a
				// failure as a benign empty list (not a real failure), exactly like `getChildren` does.
				const isEndpoint = supertype === 'endpoint';
				try {
					const appBase = `${baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer('app')}/${appName}`;
					const typePart = Core.pathDeterminer(supertype);
					// Connections and webhooks are not versioned; everything else needs the version segment.
					const uri = Core.isVersionable(supertype) ? `${appBase}/${appVersion}/${typePart}` : `${appBase}/${typePart}`;

					const response = await Core.rpGet(uri, authorization, undefined, isEndpoint);
					const items = unwrapComponentsResponse(response, groupPlural);
					return { components: items.map((item) => toComponentSummary(item, supertype, groupPlural)), failed: false };
				} catch (err: unknown) {
					if (isEndpoint) {
						return { components: [], failed: false };
					}
					// Isolate per-type failures so one bad/missing endpoint does not break the whole search.
					// `rpGet` already logs at error level (via `showAndLogError`) before throwing, so log at
					// `warn` here to avoid duplicate error noise; guard against `err` not being an `Error`.
					const message = err instanceof Error ? err.message : String(err);
					log('warn', `App component search: failed to load ${groupPlural} of ${appName}: ${message}`);
					return { components: [], failed: true };
				}
			},
		),
	);

	return {
		components: perGroup.flatMap((group) => group.components),
		failedGroups: COMPONENT_GROUPS.filter((_, index) => perGroup[index].failed),
	};
}

/**
 * Selects the pending-change records that belong to a given component group, mirroring the
 * group filter in `AppsProvider.getChildren`: the API change `group` is normalized
 * (`account` -> `connection`, `hook` -> `webhook`) and the synthetic `groups` change (the
 * categories node) is excluded.
 */
function changesForGroup(appChanges: AppComponentChange[] | undefined, supertype: string): AppComponentChange[] {
	if (!Array.isArray(appChanges)) {
		return [];
	}
	return appChanges.filter((change) => {
		const normalizedGroup =
			change.group === 'account' ? 'connection' : change.group === 'hook' ? 'webhook' : change.group;
		return normalizedGroup === supertype && change.code !== 'groups';
	});
}

/**
 * Rebuilds the tree node (`Item`) for a component so it can be passed to
 * `TreeView.reveal`. The node ids are deterministic and match what
 * `AppsProvider.getChildren` produces, which is what reveal matches on:
 *   `App.id = name@version` -> `Group.id = <app.id>_<plural>` -> `Item.id = <group.id>_<name>`.
 *
 * The pending-change subsets are also rebuilt from `appNode.changes` (same filtering as the
 * tree) so the revealed node renders the "changed" marker exactly like the lazily-built one.
 *
 * @param appNode The real `App` tree node the command was invoked on (used as the ancestor).
 * @param summary The picked component summary.
 */
export function buildComponentTreeItem(appNode: AppTreeNode, summary: AppComponentSummary): InstanceType<typeof Item> {
	// The group `id` must stay `groupPlural` (that is what reveal matches on), but the label is
	// humanized to match what `AppsProvider.getChildren` renders.
	const groupLabel = GROUP_LABELS[summary.groupPlural] ?? summary.groupPlural;
	const groupChanges = changesForGroup(appNode.changes, summary.supertype);
	const itemChanges = groupChanges.filter((change) => change.item === summary.name);
	const group = new Group(summary.groupPlural, groupLabel, appNode, groupChanges);
	return new Item(
		summary.name,
		summary.label,
		group,
		summary.supertype,
		summary.type,
		summary.public,
		summary.approved,
		itemChanges,
		summary.description,
		summary.crud,
	);
}
