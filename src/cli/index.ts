// Use CLI implementation of `vscode` wrapper
import { vscodeLibWrapperFactory } from '../services/vscode-lib-wraper';
vscodeLibWrapperFactory.setMode('cli');
const vscode = vscodeLibWrapperFactory.lib;

process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',app:*' : 'app:*';

import * as fs from 'node:fs/promises';
import * as path from 'path';
import debugFactory from 'debug';
import { bulkDeploy } from '../local-development/deploy';

const debug = debugFactory('app:main');

async function mainCli() {
	let rootDir: string | undefined = process.argv[3];
	if (!rootDir) {
		console.error('Please provide the project root directory as the second argument.');
		return;
	}
	// if rootDir is relative path, make it absolute based on current working directory.
	if (path.isAbsolute(rootDir) === false) {
		rootDir = path.resolve(process.cwd(), rootDir);
	}

	debug(`Using project root directory: ${rootDir}`);

	if ((await fs.stat(rootDir)).isDirectory() === false) {
		console.error(`The provided project root directory "${rootDir}" is not a directory or does not exist.`);
		return;
	}

	// -- `deploy` command --
	if (process.argv[2] === 'deploy') {
		const uri = vscode.Uri.file(rootDir);
		await bulkDeploy(uri);
	} else {
		console.error(`Unknown command ${process.argv[2]}. Supported commands: deploy`);
	}
}

mainCli();
