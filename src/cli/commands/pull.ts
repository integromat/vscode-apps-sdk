import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command, Option } from 'commander';
import { storeCurrentCliContext } from '../cli-context';
import { askForProjectOrigin } from '../../local-development/ask-origin';
import { downloadOriginChecksums } from '../../local-development/helpers/origin-checksum';
import { pullAllComponents } from '../../local-development/pull';
import { Uri } from '../../services/vscode-lib-wraper/vscode-cli-modules/uri';

export function registerPullCommand(program: Command): void {
  program
    .command('pull')
    .description('Pull updates from Make into the local app project. Adds new components and updates existing ones.')
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
      `Examples:\n  ${program.name()} pull --local-dir ./my-app\n    - Pulls all components from Make into ./my-app, updating existing and adding new ones.`,
    )
    .action(async function () {
      const cliOptions = this.opts() as { localDir: string };
      storeCurrentCliContext('pull', {}, cliOptions);

      const localDir = path.resolve(cliOptions.localDir);
      const localAppRootdir = Uri.file(localDir) as unknown as any; // IVscode.Uri

      // Select origin (uses CLI-compatible vscode lib wrapper)
      const origin = await askForProjectOrigin(localAppRootdir);
      if (!origin) {
        return; // user cancelled
      }

      const originChecksums = await downloadOriginChecksums(origin);

      await pullAllComponents(localAppRootdir, origin, 'askUser', originChecksums);
    });
}
