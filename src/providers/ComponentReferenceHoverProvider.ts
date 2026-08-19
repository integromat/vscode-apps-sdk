import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	fetchAppComponentsSummary,
	type AppComponentsSummaryResult,
} from '../libs/app-component-search';
import { detectReferenceAt, parseOnlineAppContext, type DetectedReference } from '../libs/component-reference';
import { isFileBelongingToExtension } from '../temp-dir';
import { getMakecomappJson, getMakecomappRootDir } from '../local-development/makecomappjson';
import { MAKECOMAPP_FILENAME } from '../local-development/consts';
import { ComponentIdMappingHelper } from '../local-development/helpers/component-id-mapping-helper';
import type { Environment } from '../types/environment.types';
import { log } from '../output-channel';

/** The component reference type maps 1:1 to a local component type and an `Item.supertype`. */
const REFERENCE_CODE_TYPE = { rpc: 'communication', function: 'code' } as const;

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
	 * Directory → local app root fsPath, or `null` when a prior walk proved this directory (and the
	 * path upward from a failed resolve) is not under a `makecomapp.json`. Avoids re-walking the
	 * filesystem on every hover over `foo(` in unrelated `.js` files.
	 */
	private readonly localAppRootCache = new Map<string, string | null>();

	constructor(private readonly authorization: string, private readonly environment: Environment) {}

	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
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
			? await this.resolveOnline(document, reference)
			: await this.resolveLocal(document.uri, reference);

		if (!target) {
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
	): Promise<OpenReferencedComponentTarget | undefined> {
		const appRootFsPath = this.findLocalAppRoot(documentUri.fsPath);
		if (!appRootFsPath) {
			return undefined;
		}

		let root: vscode.Uri;
		let makecomappJson: Awaited<ReturnType<typeof getMakecomappJson>>;
		try {
			root = getMakecomappRootDir(documentUri);
			makecomappJson = await getMakecomappJson(documentUri);
		} catch {
			// Treat as miss: either a race (cache said there is a root but the file became
			// unreadable) or a genuine data problem (e.g. a malformed makecomapp.json). Either way
			// there is nothing openable to hover, so fail silently rather than showing a hover error.
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

		const relativePath = components[localId]?.codeFiles?.[REFERENCE_CODE_TYPE[reference.kind]];
		if (!relativePath) {
			return undefined;
		}

		return { mode: 'local', fileUri: vscode.Uri.joinPath(root, relativePath).toString() };
	}

	/**
	 * Walks from the file's directory upward looking for `makecomapp.json`, caching hits and misses
	 * per directory so unrelated workspace `.js` hovers do not repeat the walk.
	 */
	private findLocalAppRoot(fileFsPath: string): string | null {
		let dir = path.dirname(fileFsPath);
		const visited: string[] = [];

		while (true) {
			const cached = this.localAppRootCache.get(dir);
			if (cached !== undefined) {
				if (cached === null) {
					for (const visitedDir of visited) {
						this.localAppRootCache.set(visitedDir, null);
					}
					return null;
				}
				for (const visitedDir of visited) {
					this.localAppRootCache.set(visitedDir, cached);
				}
				return cached;
			}

			visited.push(dir);
			if (fs.existsSync(path.join(dir, MAKECOMAPP_FILENAME))) {
				for (const visitedDir of visited) {
					this.localAppRootCache.set(visitedDir, dir);
				}
				return dir;
			}

			const parent = path.dirname(dir);
			if (parent === dir) {
				break;
			}
			dir = parent;
		}

		for (const visitedDir of visited) {
			this.localAppRootCache.set(visitedDir, null);
		}
		return null;
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
		markdown.isTrusted = true;
		markdown.supportThemeIcons = true;
		return new vscode.Hover(markdown, range);
	}
}
