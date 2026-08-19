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
 * RPC / custom-function names. This allow-list is exactly what filters out built-in IML functions
 * such as `length()` or `join()` (they are not in the app's custom-function list).
 */

export type ReferenceKind = 'rpc' | 'function';

/**
 * Where function-call detection is allowed on a line:
 *  - `anywhere` — whole line (used for `.js` function code files),
 *  - `iml-templates` — only inside `{{ ... }}` regions (used for `imljson`).
 */
export type FunctionDetectScope = 'anywhere' | 'iml-templates';

export interface DetectReferenceOptions {
	functionScope?: FunctionDetectScope;
}

export interface DetectedReference {
	kind: ReferenceKind;
	/** The referenced component name exactly as written in code (RPC remote name or function name). */
	name: string;
	/** 0-based column of the first character of the hover range. */
	startColumn: number;
	/** 0-based column just past the last character of the hover range (half-open: `[start, end)`). */
	endColumn: number;
}

// `rpc://Name` - Make RPC names use letters, digits, underscores and hyphens.
const RPC_REFERENCE_REGEX = /rpc:\/\/([A-Za-z0-9_-]+)/g;
// `identifier(` - a function call. Identifier follows JS rules (functions are JS-named in Make).
const FUNCTION_CALL_REGEX = /([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
// Non-greedy `{{ ... }}` regions on a single line (IML templates in imljson strings).
const IML_TEMPLATE_REGEX = /\{\{[\s\S]*?\}\}/g;

/**
 * Finds a component reference whose hover range contains the given 0-based `column` on a single
 * line of text. RPC references take precedence over function calls. Returns `undefined` when the
 * cursor is not over a recognizable reference.
 *
 * Ranges are half-open `[startColumn, endColumn)`. For RPC the range spans the whole `rpc://Name`
 * token; for a function call it spans only the identifier (not the `(`).
 *
 * @param options.functionScope Defaults to `anywhere`. Use `iml-templates` for imljson so bare
 *   `foo(` outside `{{ }}` (e.g. in plain JSON) does not produce a function hover.
 */
export function detectReferenceAt(
	line: string,
	column: number,
	options?: DetectReferenceOptions,
): DetectedReference | undefined {
	RPC_REFERENCE_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = RPC_REFERENCE_REGEX.exec(line)) !== null) {
		const start = match.index;
		const end = match.index + match[0].length;
		if (column >= start && column < end) {
			return { kind: 'rpc', name: match[1], startColumn: start, endColumn: end };
		}
	}

	const functionScope = options?.functionScope ?? 'anywhere';
	const templateRegions =
		functionScope === 'iml-templates' ? findImlTemplateRegions(line) : undefined;

	FUNCTION_CALL_REGEX.lastIndex = 0;
	while ((match = FUNCTION_CALL_REGEX.exec(line)) !== null) {
		const start = match.index;
		// Hover range is the identifier only, excluding any whitespace and the `(`.
		const end = match.index + match[1].length;
		if (column < start || column >= end) {
			continue;
		}
		if (templateRegions && !isInsideAnyRegion(start, end, templateRegions)) {
			continue;
		}
		return { kind: 'function', name: match[1], startColumn: start, endColumn: end };
	}

	return undefined;
}

/** Returns half-open `[start, end)` column ranges for each `{{ ... }}` on the line. */
function findImlTemplateRegions(line: string): { start: number; end: number }[] {
	const regions: { start: number; end: number }[] = [];
	IML_TEMPLATE_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = IML_TEMPLATE_REGEX.exec(line)) !== null) {
		regions.push({ start: match.index, end: match.index + match[0].length });
	}
	return regions;
}

function isInsideAnyRegion(
	start: number,
	end: number,
	regions: { start: number; end: number }[],
): boolean {
	return regions.some((region) => start >= region.start && end <= region.end);
}

/**
 * Extracts the app name and major version from an online temp-file path (the files this extension
 * downloads while editing a cloud app). Mirrors `CoreCommands.keepProviders` /
 * `ImljsonSchemaAssociations.parseAppAndVersion`: after the `apps-sdk` temp segment the path is
 * `/sdk/apps/<appName>/<version>/<typePlural>/<componentName>/<code>.<ext>` (`sdk` is a fixed crumb
 * that is shifted off so `appName` lands at index 2 and `version` at index 3).
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
	// Drop the fixed `sdk` crumb so indices match keepProviders / parseAppAndVersion.
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
