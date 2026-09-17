/**
 * Assembles the publishable npm package for the `make-cli` command into `dist-cli/`.
 *
 * The repository root `package.json` is the VSCode extension manifest (`apps-sdk`) and must stay that way:
 * its `name` is half of the marketplace extension id `Integromat.apps-sdk`. npm offers no way to rename a
 * package at publish time (`publishConfig` only accepts npm config options, not manifest fields), so the CLI
 * is published from its own directory instead - `npm publish ./dist-cli` reads that directory's manifest.
 *
 * Run via `npm run cli:pack` (which builds `out/` first).
 */

import { createRequire } from 'node:module';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(repoRoot, 'out');
const outputDir = path.join(repoRoot, 'dist-cli');
const cliEntrypoint = path.join(buildDir, 'cli', 'index.js');

/**
 * Modules reachable from the CLI entrypoint only through the `ide` branch of a mode switch
 * (see `src/services/ide-or-cli-mode.ts`). They are `require()`d lazily and never load in CLI mode,
 * so they are excluded from the dependency scan - otherwise the CLI package would drag in the whole
 * VSCode-only dependency tree (`jimp`, `applicationinsights`, ...), which is ~30x larger installed.
 */
const ideOnlyModules = [
	'logging-ide.js',
	'services/workspace-ide.js',
	'services/vscode-lib-wraper/vscode-ide-modules',
	'utils/telemetry-ide.js',
	'utils/vscode-progress-dialog-ide.js',
	'local-development/ask-add-missing-apikey-ide.js',
];

function isIdeOnly(absolutePath) {
	const relativePath = path.relative(buildDir, absolutePath).split(path.sep).join('/');
	return ideOnlyModules.some((ideOnly) => relativePath === ideOnly || relativePath.startsWith(ideOnly + '/'));
}

/** Resolves a relative `require()` target the way the CJS loader would. */
function resolveRelative(fromFile, target) {
	const base = path.resolve(path.dirname(fromFile), target);
	for (const candidate of [base, base + '.js', path.join(base, 'index.js')]) {
		if (existsSync(candidate) && statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return undefined;
}

/**
 * Walks the compiled CJS module graph from the CLI entrypoint and collects the bare (external)
 * module specifiers it can actually reach.
 */
function collectReachableDependencies() {
	const visited = new Set();
	const externals = new Set();
	const queue = [cliEntrypoint];

	while (queue.length > 0) {
		const file = queue.pop();
		if (visited.has(file) || isIdeOnly(file)) {
			continue;
		}
		visited.add(file);

		const source = readFileSync(file, 'utf8');
		// Both quote styles matter: `tsc` emits double quotes for compiled imports, but hand-written
		// `require()` calls (the lazy IDE/CLI mode switches) keep their original single quotes.
		for (const match of source.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
			const target = match[2];

			if (target.startsWith('.')) {
				const resolved = resolveRelative(file, target);
				if (resolved) {
					queue.push(resolved);
				}
				continue;
			}
			// `vscode` is provided by the extension host and is only reachable through IDE-only modules.
			if (target.startsWith('node:') || target === 'vscode') {
				continue;
			}
			// Reduce a subpath import (`lodash/pick`) to its package name (`lodash`, `@scope/name`).
			const segments = target.split('/');
			externals.add(target.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]);
		}
	}

	return { externals, moduleCount: visited.size };
}

// --- build -------------------------------------------------------------------------------------

if (!existsSync(cliEntrypoint)) {
	throw new Error(`CLI build output not found at "${cliEntrypoint}". Run \`npm run cli:build\` first.`);
}

const rootManifest = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const { externals, moduleCount } = collectReachableDependencies();

const builtinModules = new Set(createRequire(import.meta.url)('node:module').builtinModules);
const dependencies = {};
const missing = [];

for (const name of [...externals].sort()) {
	if (builtinModules.has(name)) {
		continue; // e.g. a bare `path` / `util` import rather than the `node:` form
	}
	const declaredVersion = rootManifest.dependencies?.[name];
	if (!declaredVersion) {
		missing.push(name);
		continue;
	}
	dependencies[name] = declaredVersion;
}

if (missing.length > 0) {
	throw new Error(
		`The CLI requires ${missing.map((name) => `"${name}"`).join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} ` +
			'not declared in the root package.json `dependencies`. Add it there first.',
	);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

// The `out/` prefix is preserved on purpose: `src/Meta.ts` reads the version via
// `path.resolve(__dirname, '..', 'package.json')`, which only resolves if the compiled files stay
// one directory below the manifest.
cpSync(buildDir, path.join(outputDir, 'out'), { recursive: true });

const cliManifest = {
	name: '@integromat/make-cli',
	// Inherited from the extension, so a release-please version bump covers both artifacts.
	version: rootManifest.version,
	description: 'CLI for local development and deployment of Make Custom Apps.',
	license: rootManifest.license ?? 'SEE LICENSE IN LICENSE.md',
	repository: {
		type: 'git',
		// Pre-normalized to the form npm would rewrite it to anyway, to keep `npm publish` warning-free.
		url: 'git+https://github.com/integromat/vscode-apps-sdk.git',
	},
	homepage: rootManifest.homepage,
	engines: { node: '>=20' },
	bin: { 'make-cli': 'out/cli/index.js' },
	dependencies,
};

writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(cliManifest, null, '\t') + '\n');

// `tsc` emits plain files, so the entrypoint carries the shebang but not the executable bit.
// `npm install` would set it when unpacking a tarball, but a locally linked package
// (`npm link ./dist-cli`) runs the file directly and fails with EACCES without this.
chmodSync(path.join(outputDir, 'out', 'cli', 'index.js'), 0o755);

for (const file of ['LICENSE.md', 'README.md']) {
	if (existsSync(path.join(repoRoot, file))) {
		cpSync(path.join(repoRoot, file), path.join(outputDir, file));
	}
}

console.log(
	`Built ${cliManifest.name}@${cliManifest.version} into dist-cli/ ` +
		`(${moduleCount} modules, ${Object.keys(dependencies).length} dependencies: ${Object.keys(dependencies).join(', ')}).\n` +
		'Publish it with: npm publish ./dist-cli',
);
