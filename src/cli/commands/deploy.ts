import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command, Option } from 'commander';
import { getCurrentCliContext, storeCurrentCliContext } from '../cli-context';
import { bulkDeploy } from '../../local-development/deploy';
import { Uri } from '../../services/vscode-lib-wraper/vscode-cli-modules/uri';
import { MAKECOMAPP_FILENAME } from '../../local-development/consts';

export function registerDeployCommand(program: Command): void {
	program
		.command('deploy')
		.description('Deploy local app changes to Make. Targets a file or directory within the project.')
		.addOption(
			new Option('--local-dir <filesystem-path>', 'The root directory of the local app project.')
				.makeOptionMandatory(true)
				.argParser((value: string) => {
					const absPath = path.resolve(value);
					const stat = fs.statSync(absPath);
					if (!stat.isDirectory()) {
						throw new Error(`The directory "${absPath}" is not a directory.`);
					}
					return path.resolve(absPath);
				}),
		)
		.addOption(
			new Option(
				'--src-prefix <relative-path>',
				`Path relative to the --local-dir where the ${MAKECOMAPP_FILENAME} file is located (default: src)`,
			).default('src'),
		)
		.addOption(new Option('--no-prompt', 'Skip all interactive prompts and accept sensible defautls'))
		.addHelpText(
			'after',
			`Examples:\n  ${program.name()} deploy --local-dir ./my-app\n    - Deploys all components under ./my-app.\n  ${program.name()} deploy --local-dir ./my-app \n    - Deploys only the components matching the specified path.`,
		)
		.action(async function () {
			const cliOptions = this.opts() as {
				localDir: string;
				srcPrefix: string;
				prompt?: boolean;
			};
			storeCurrentCliContext('deploy', {}, cliOptions);

			console.log(
				`Executing command: '${getCurrentCliContext().command}'. Arguments: ${JSON.stringify(
					getCurrentCliContext().arguments,
				)}. Options: ${JSON.stringify(cliOptions)}.`,
			);

			await bulkDeploy(Uri.file(path.join(cliOptions.localDir, cliOptions.srcPrefix)) as unknown as any, {
				askForPrompts: cliOptions.prompt,
			});
		});
}
