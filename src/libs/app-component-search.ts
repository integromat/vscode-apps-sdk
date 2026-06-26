import camelCase from 'lodash/camelCase';
import * as Core from '../Core';
import { log } from '../output-channel';
import type { Environment } from '../types/environment.types';
import Group from '../tree/Group';
import Item from '../tree/Item';

/**
 * A flattened description of a single app component (connection, webhook, module,
 * RPC or function) sufficient to display it in a Quick Pick and to rebuild the
 * matching tree node for `TreeView.reveal`.
 */
export interface AppComponentSummary {
	/** Internal component name (the API id). This is what the user searches by when it differs from the label. */
	name: string;
	/** Human-readable label (mirrors the tree's label fallbacks; functions fall back to `name + args`). */
	label: string;
	/** Singular component type, e.g. `module` / `rpc` (matches `Item.supertype`). */
	supertype: string;
	/** API plural used as the tree group id, e.g. `modules` / `rpcs`. */
	groupPlural: string;
	/** Module type id (only meaningful for modules); undefined otherwise. */
	type: number | undefined;
	public: boolean | undefined;
	approved: boolean | undefined;
	description: string | undefined;
	crud: string | undefined;
}

interface FetchAppComponentsOptions {
	baseUrl: string;
	authorization: string;
	environment: Environment;
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

/** API plural names of the component groups, in the order they should be listed. */
const COMPONENT_GROUPS = ['connections', 'webhooks', 'modules', 'rpcs', 'functions'] as const;

/**
 * Unwraps the component list from a Make API response. v1 returns the array directly,
 * while v2 nests it under `app<GroupPlural>` (e.g. `appModules`). Mirrors the level-2
 * logic in `AppsProvider.getChildren`.
 */
export function unwrapComponentsResponse(response: any, groupPlural: string, version: number): any[] {
	const items = version === 1 ? response : response?.[camelCase(`app_${groupPlural}`)];
	return Array.isArray(items) ? items : [];
}

/**
 * Maps a single raw API component to a flat summary, using the same label fallback as the
 * tree (`Item`): a present `label` wins, otherwise functions fall back to `name + args`.
 */
export function toComponentSummary(item: any, supertype: string, groupPlural: string): AppComponentSummary {
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
 * Fetches the components of a single app across all five component types and returns the
 * flattened summaries together with the API plural names of any groups whose fetch failed.
 * Each type is fetched independently: a single failing/missing type is logged and skipped so
 * the rest still resolve, and the caller can tell a genuinely empty app from a failed load.
 *
 * Faithfully mirrors the level-2 logic in `AppsProvider.getChildren`:
 *  - connections/webhooks URIs omit the app version segment,
 *  - the v2 response is unwrapped via `response[camelCase('app_<plural>')]`,
 *  - the label uses the same fallback as the tree (`label || name + args`).
 */
export async function fetchAppComponentsSummary(
	options: FetchAppComponentsOptions,
): Promise<AppComponentsSummaryResult> {
	const { baseUrl, authorization, environment, appName, appVersion } = options;

	const perGroup = await Promise.all(
		COMPONENT_GROUPS.map(
			async (groupPlural): Promise<{ components: AppComponentSummary[]; failed: boolean }> => {
				const supertype = groupPlural.slice(0, -1);
				try {
					const sdkPart = Core.pathDeterminer(environment.version, '__sdk');
					const appPart = Core.pathDeterminer(environment.version, 'app');
					const typePart = Core.pathDeterminer(environment.version, supertype);
					const appBase = `${baseUrl}/${sdkPart}${appPart}/${appName}`;
					// Connections and webhooks are not versioned; everything else needs the version segment.
					const uri = Core.isVersionable(supertype)
						? `${appBase}/${appVersion}/${typePart}`
						: `${appBase}/${typePart}`;

					const response = await Core.rpGet(uri, authorization);
					const items = unwrapComponentsResponse(response, groupPlural, environment.version);
					return { components: items.map((item) => toComponentSummary(item, supertype, groupPlural)), failed: false };
				} catch (err: any) {
					// Isolate per-type failures so one bad/missing endpoint does not break the whole search.
					log('error', `App component search: failed to load ${groupPlural} of ${appName}: ${err.message}`);
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
 * Rebuilds the tree node (`Item`) for a component so it can be passed to
 * `TreeView.reveal`. The node ids are deterministic and match what
 * `AppsProvider.getChildren` produces, which is what reveal matches on:
 *   `App.id = name@version` -> `Group.id = <app.id>_<plural>` -> `Item.id = <group.id>_<name>`.
 *
 * @param appNode The real `App` tree node the command was invoked on (used as the ancestor).
 * @param summary The picked component summary.
 */
export function buildComponentTreeItem(appNode: any, summary: AppComponentSummary): any {
	const group = new (Group as any)(summary.groupPlural, summary.groupPlural, appNode, []);
	return new (Item as any)(
		summary.name,
		summary.label,
		group,
		summary.supertype,
		summary.type,
		summary.public,
		summary.approved,
		[],
		summary.description,
		summary.crud,
	);
}
