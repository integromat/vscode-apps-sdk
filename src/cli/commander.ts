/**
 * @module Commander
 *
 * Provides a centralized command line argument parser for the CLI mode.
 *
 */

import * as fs from 'node:fs';
import { Command, Option } from 'commander';
import { cloneAppToWorkspace } from '../local-development/clone';
import { getCurrentCliContext, storeCurrentCliContext } from './cli-context';

export const cliProgram = new Command();

cliProgram.name('makeapps-cli').description('A CLI tool for local development and deployment of Make.com Custom Apps.');

cliProgram
	.command('clone')
	.description('Clones the Make Custom App (placed in Make.com) to local file system as a new project.')
	// parameter "directory"
	.argument('<app-name>', 'The name of the Make Custom App to clone.')
	.addOption(
		new Option('--local-dir <filesystem-path>', 'The directory where the app will be cloned to.')
			.makeOptionMandatory(true)
			.argParser((value: string) => {
				const stat = fs.statSync(value);
				// Must be a directory.
				if (!stat.isDirectory()) {
					throw new Error(`The directory "${value}" is not a directory.`);
				}
				// Must be empty.
				if (fs.readdirSync(value).length > 0) {
					throw new Error(
						`The directory "${value}" is not empty. Please, use an empty directory as target directory for Custom App clone.`,
					);
				}
				return value;
			}),
	)
	.addOption(
		new Option('--app-major <integer>', 'The major version of the Make Custom App').preset(1).argParser((value) => {
			// test if value is an integer by regex
			if (!/^\d+$/.test(value)) {
				throw new Error(`The value "${value}" is not an integer.`);
			}
			return parseInt(value);
		}),
	)
	.addOption(
		new Option('--make-host <string>', 'The host of the Make Custom App. Example: "eu1.make.com"')
			.makeOptionMandatory(true)
			.argParser((value) => {
				// test if value is a valid host by regex
				if (!/^[a-z][0-9a-z-.]+[a-z]$/.test(value)) {
					throw new Error(`The value "${value}" is not a valid host.`);
				}
				return value;
			}),
	)
	.addOption(
		new Option(
			'--project-root <string>',
			'The target of the Make Custom App. Used the current working directory if not provided.',
		).preset(process.cwd()),
	)
	.addOption(new Option('--include-common-data', 'Include common data').preset(false))
	.addHelpText(
		'after',
		`Example:\n  ${cliProgram.name()} clone my-app --make-host eu1.make.com --local-dir ./my-app\n    - Clones the Make app "my-app" to the local directory "./my-app".`,
	)
	.action(async function (directory: string) {
		const cliOptions = this.opts();
		storeCurrentCliContext('clone', { directory }, cliOptions);

		// debug output
		console.log(
			`Executing command: '${getCurrentCliContext().command}'. Arguments: ${JSON.stringify(
				getCurrentCliContext().arguments,
			)}. Options: ${JSON.stringify(cliOptions)}.`,
		);

		await cloneAppToWorkspace({
			name: cliOptions.appId as string,
			version: cliOptions.appMajor as number,
		});
	});
