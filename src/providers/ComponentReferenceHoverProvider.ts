import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	fetchAppComponentsSummary,
	type AppComponentsSummaryResult,
} from '../libs/app-component-search';
import {
	detectReferenceAt,
	parseOnlineAppContext,
	REFERENCE_CODE_DEF,
	type DetectedReference,
} from '../libs/component-reference';
import { isFileBelongingToExtension } from '../temp-dir';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { ComponentIdMappingHelper } from '../local-development/helpers/component-id-mapping-helper';
import type { Environment } from '../types/environment.types';
import { log } from '../output-channel';

/** Payload handed to `apps-sdk.open-referenced-component` when the hover link is clicked. */
export type OpenReferencedComponentTarget =
	| { mode: 'online'; appName: string; appVersion: number; supertype: 'rpc' | 'function'; componentName: string }
	| { mode: 'local'; fileUri: string };

/**
 * Shows a hover popup with an "Open" command-link over component references (`rpc://Name` and
 * custom IML function calls) in app code. Works for both online mode (cloud temp files) and
 * local-development mode (files under a `makecomapp.json`). Resolution is what gates the hover:
 * a popup only appears when the referenced component actually exists in the current app, which also
 * keeps built-in IML functions from being offered.
 */
export class ComponentReferenceHoverProvider implements vscode.HoverProvider {
	/** Caches the online component fetch per `appName@version` to avoid an API call on every hover. */
	private readonly onlineCache = new Map<string, { at: number; result: Promise<AppComponentsSummaryResult> }>();
	private static readonly ONLINE_CACHE_TTL_MS = 30_000;

	/**
	 * Hovered-file directory → local app root fsPath, or `null` when a prior lookup proved this
	 * directory is not under a `makecomapp.json`. Avoids re-walking the filesystem (via
	 * `getMakecomappRootDir`) on every hover over `foo(` in unrelated `.js` files.
	 *
	 * Negative (`null`) entries never go stale on their own — call `clearLocalAppRootCache()`
	 * when a `makecomapp.json` is created or deleted anywhere in the workspace (wired up in
	 * `extension.ts` via a `FileSystemWatcher`), otherwise a directory hovered before an app was
	 * cloned into it would stay "not a Make project" until the window reloads.
	 */
	private readonly localAppRootCache = new Map<string, string | null>();

	constructor(private readonly authorization: string, private readonly environment: Environment) {}

	/** Clears the local-app-root cache. Call when a `makecomapp.json` is created or deleted. */
	clearLocalAppRootCache(): void {
		this.localAppRootCache.clear();
	}

	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
	): Promise<vscode.Hover | undefined> {
		const isOnline = isFileBelongingToExtension(document.fileName);
		// imljson: only treat `foo(` inside `{{ }}` as a function reference. javascript: whole file.
		const functionScope = document.languageId === 'imljson' ? 'iml-templates' : 'anywhere';
		const line = document.lineAt(position.line).text;
		const reference = detectReferenceAt(line, position.character, { functionScope });
		if (!reference) {
			return undefined;
		}

		const target = isOnline
			? await this.resolveOnline(document, reference, token)
			: await this.resolveLocal(document.uri, reference, token);

		if (!target || token.isCancellationRequested) {
			return undefined;
		}

		return this.buildHover(reference, target, position);
	}

	/**
	 * Returns the (possibly cached) component summary for an online app. Used by the open command
	 * so a click after hover does not repeat the network fetch.
	 */
	getComponentsForApp(appName: string, version: number): Promise<AppComponentsSummaryResult> {
		return this.getOnlineComponents(appName, version);
	}

	/** Resolves an online (cloud) reference into a command target, or `undefined` if unknown. */
	private async resolveOnline(
		document: vscode.TextDocument,
		reference: DetectedReference,
		token: vscode.CancellationToken,
	): Promise<OpenReferencedComponentTarget | undefined> {
		const context = parseOnlineAppContext(document.fileName);
		if (!context) {
			return undefined;
		}

		let components: AppComponentsSummaryResult['components'];
		try {
			({ components } = await this.getOnlineComponents(context.appName, context.version));
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			log('warn', `Component reference hover: failed to load components of ${context.appName}: ${message}`);
			return undefined;
		}
		// The user may have moved the mouse away while the (possibly uncached) API call was in flight.
		if (token.isCancellationRequested) {
			return undefined;
		}

		const exists = components.some(
			(component) => component.supertype === reference.kind && component.name === reference.name,
		);
		if (!exists) {
			return undefined;
		}

		return {
			mode: 'online',
			appName: context.appName,
			appVersion: context.version,
			supertype: reference.kind,
			componentName: reference.name,
		};
	}

	/** Resolves a local-development reference to the on-disk code file URI, or `undefined`. */
	private async resolveLocal(
		documentUri: vscode.Uri,
		reference: DetectedReference,
		token: vscode.CancellationToken,
	): Promise<OpenReferencedComponentTarget | undefined> {
		const appRootFsPath = this.findLocalAppRoot(documentUri);
		if (!appRootFsPath) {
			return undefined;
		}

		let makecomappJson: Awaited<ReturnType<typeof getMakecomappJson>>;
		try {
			// Read-only: a hover must never have the side effect of migrating-and-saving
			// makecomapp.json (that would silently dirty a git-tracked file on mouse-over).
			makecomappJson = await getMakecomappJson(documentUri, { readOnly: true });
		} catch {
			// Treat as miss: either a race (cache said there is a root but the file became
			// unreadable) or a genuine data problem (e.g. a malformed makecomapp.json). Either way
			// there is nothing openable to hover, so fail silently rather than showing a hover error.
			return undefined;
		}
		if (token.isCancellationRequested) {
			return undefined;
		}

		const components = makecomappJson.components[reference.kind];
		if (!components) {
			return undefined;
		}

		// The token may be a local id directly, or a remote name that maps to a local id via an origin.
		let localId: string | undefined = components[reference.name] ? reference.name : undefined;
		if (!localId) {
			for (const origin of makecomappJson.origins ?? []) {
				const mapped = new ComponentIdMappingHelper(makecomappJson, origin).getLocalId(
					reference.kind,
					reference.name,
				);
				if (mapped && components[mapped]) {
					localId = mapped;
					break;
				}
			}
		}
		if (!localId) {
			return undefined;
		}

		const relativePath = components[localId]?.codeFiles?.[REFERENCE_CODE_DEF[reference.kind].codeType];
		if (!relativePath) {
			return undefined;
		}

		const root = vscode.Uri.file(appRootFsPath);
		return { mode: 'local', fileUri: vscode.Uri.joinPath(root, relativePath).toString() };
	}

	/**
	 * Resolves the `makecomapp.json` root directory for the hovered file's directory, caching hits
	 * and misses so unrelated workspace `.js` hovers do not repeat the walk. Delegates to
	 * `getMakecomappRootDir` (the same helper every other local-dev flow uses) rather than
	 * re-implementing the upward walk, so this also correctly stays within the workspace boundary.
	 */
	private findLocalAppRoot(documentUri: vscode.Uri): string | null {
		const cacheKey = path.dirname(documentUri.fsPath);
		const cached = this.localAppRootCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		let root: string | null;
		try {
			root = getMakecomappRootDir(documentUri).fsPath;
		} catch {
			root = null;
		}
		this.localAppRootCache.set(cacheKey, root);
		return root;
	}

	private getOnlineComponents(appName: string, version: number): Promise<AppComponentsSummaryResult> {
		const key = `${appName}@${version}`;
		const cached = this.onlineCache.get(key);
		if (cached && Date.now() - cached.at < ComponentReferenceHoverProvider.ONLINE_CACHE_TTL_MS) {
			return cached.result;
		}
		const result = fetchAppComponentsSummary({
			baseUrl: this.environment.baseUrl,
			authorization: this.authorization,
			appName,
			appVersion: version,
		});
		this.onlineCache.set(key, { at: Date.now(), result });
		// Do not keep a rejected promise in the cache — the next hover should retry.
		result.catch(() => {
			const current = this.onlineCache.get(key);
			if (current?.result === result) {
				this.onlineCache.delete(key);
			}
		});
		return result;
	}

	private buildHover(
		reference: DetectedReference,
		target: OpenReferencedComponentTarget,
		position: vscode.Position,
	): vscode.Hover {
		const range = new vscode.Range(position.line, reference.startColumn, position.line, reference.endColumn);
		const args = encodeURIComponent(JSON.stringify([target]));
		const label = reference.kind === 'rpc' ? 'RPC' : 'function';
		const markdown = new vscode.MarkdownString(
			`$(go-to-file) [Open ${label} \`${reference.name}\`](command:apps-sdk.open-referenced-component?${args})`,
		);
		// Trust only this specific command, not every command URI the markdown could contain.
		markdown.isTrusted = { enabledCommands: ['apps-sdk.open-referenced-component'] };
		markdown.supportThemeIcons = true;
		return new vscode.Hover(markdown, range);
	}
}
