/**
 * Pure helpers for detecting references to other app components inside app code, and for
 * resolving the current app context from an online temp-file path.
 *
 * Two kinds of references are recognized:
 *  - RPC references written as `rpc://<name>` (in `imljson` string values),
 *  - custom IML function calls written as `<name>(` (in `imljson` `{{ ... }}` templates and in
 *    function `.js` code).
 *
 * Detection here is intentionally syntactic only. Deciding whether a detected token is a *real*,
 * openable component is the caller's job: it matches the token against the current app's known
 * RPC / custom-function names. That allow-list is exactly what filters out built-in IML functions
 * such as `length()` or `join()` (they are not in the app's custom-function list).
 */

export type ReferenceKind = 'rpc' | 'function';

export interface DetectedReference {
	kind: ReferenceKind;
	/** The referenced component name exactly as written in code (RPC remote name or function name). */
	name: string;
	/** 0-based column of the first character of the hover range. */
	startColumn: number;
	/** 0-based column just past the last character of the hover range. */
	endColumn: number;
}

// `rpc://Name` - Make RPC names use letters, digits, underscores and hyphens.
const RPC_REFERENCE_REGEX = /rpc:\/\/([A-Za-z0-9_-]+)/g;
// `identifier(` - a function call. Identifier follows JS rules (functions are JS-named in Make).
const FUNCTION_CALL_REGEX = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

/**
 * Finds a component reference whose hover range contains the given 0-based `column` on a single
 * line of text. RPC references take precedence over function calls. Returns `undefined` when the
 * cursor is not over a recognizable reference.
 *
 * For RPC the hover range spans the whole `rpc://Name` token; for a function call it spans only the
 * identifier (not the `(`).
 */
export function detectReferenceAt(line: string, column: number): DetectedReference | undefined {
	RPC_REFERENCE_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = RPC_REFERENCE_REGEX.exec(line)) !== null) {
		const start = match.index;
		const end = match.index + match[0].length;
		if (column >= start && column <= end) {
			return { kind: 'rpc', name: match[1], startColumn: start, endColumn: end };
		}
	}

	FUNCTION_CALL_REGEX.lastIndex = 0;
	while ((match = FUNCTION_CALL_REGEX.exec(line)) !== null) {
		const start = match.index;
		// Hover range is the identifier only, excluding any whitespace and the `(`.
		const end = match.index + match[1].length;
		if (column >= start && column <= end) {
			return { kind: 'function', name: match[1], startColumn: start, endColumn: end };
		}
	}

	return undefined;
}

/**
 * Extracts the app name and major version from an online temp-file path (the files this extension
 * downloads while editing a cloud app). Mirrors the crumb logic in
 * `CoreCommands.keepProviders`: after the `apps-sdk` temp segment the path is
 * `[/sdk]/<appPlural>/<appName>/<version>/<typePlural>/<componentName>/<code>.<ext>`, where the
 * leading `sdk` segment is present only on API v2.
 *
 * Returns `undefined` when the path is not an online app code file or the version is not numeric
 * (e.g. unversioned connection/webhook code or app-level files), in which case an RPC/function
 * reference cannot be resolved.
 */
export function parseOnlineAppContext(fsPath: string): { appName: string; version: number } | undefined {
	const tempSegmentIndex = fsPath.lastIndexOf('apps-sdk');
	if (tempSegmentIndex === -1) {
		return undefined;
	}
	const right = fsPath.slice(tempSegmentIndex + 'apps-sdk'.length).replace(/\\/g, '/');
	const crumbs = right.split('/');
	// Drop the leading empty crumb so v1 (`/app/...`) and v2 (`/sdk/apps/...`) align on the same indices.
	if (crumbs[1] === 'sdk') {
		crumbs.shift();
	}
	const appName = crumbs[2];
	const version = Number(crumbs[3]);
	if (!appName || Number.isNaN(version)) {
		return undefined;
	}
	return { appName, version };
}
