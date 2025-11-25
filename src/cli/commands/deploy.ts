import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command, Option } from 'commander';
import { storeCurrentCliContext } from '../cli-context';
import { bulkDeploy } from '../../local-development/deploy';
import { Uri } from '../../services/vscode-lib-wraper/vscode-cli-modules/uri';

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy local app changes to Make. Targets a file or directory within the project.')
    .addOption(
      new Option('--local-dir <filesystem-path>', 'The root directory of the local app project.')
        .makeOptionMandatory(true)
        .argParser((value: string) => {
          const stat = fs.statSync(value);
          if (!stat.isDirectory()) {
            throw new Error(`The directory "${value}" is not a directory.`);
          }
          return path.resolve(value);
        }),
    )
    .addHelpText(
      'after',
      `Examples:\n  ${program.name()} deploy --local-dir ./my-app\n    - Deploys all components under ./my-app.\n  ${program.name()} deploy --local-dir ./my-app \n    - Deploys only the components matching the specified path.`,
    )
    .action(async function () {
      const cliOptions = this.opts() as { localDir: string; target?: string };
      storeCurrentCliContext('deploy', {}, cliOptions);

      const localDir = path.resolve(cliOptions.localDir);
		console.log('The dir!');
		console.log(localDir);
      await bulkDeploy(Uri.file(localDir) as unknown as any);
    });
}
