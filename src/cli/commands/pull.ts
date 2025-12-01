import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command, Option } from 'commander';
import { storeCurrentCliContext } from '../cli-context';
import { askForProjectOrigin } from '../../local-development/ask-origin';
import { downloadOriginChecksums } from '../../local-development/helpers/origin-checksum';
import { pullAllComponents } from '../../local-development/pull';
import { Uri } from '../../services/vscode-lib-wraper/vscode-cli-modules/uri';
import { MAKECOMAPP_FILENAME } from '../../local-development/consts';

export function registerPullCommand(program: Command): void {
  program
    .command('pull')
    .description(
      'Pull updates from Make into the local app project. Adds new components and updates existing ones.',
    )
    .addOption(
      new Option('--local-dir <filesystem-path>', 'The root directory of the local app project.')
        .makeOptionMandatory(true)
        .argParser((value: string) => {
          const absPath = path.resolve(value);

          const stat = fs.statSync(absPath);
          if (!stat.isDirectory()) {
            throw new Error(`The directory "${absPath}" is not a directory.`);
          }

          return absPath;
        }),
    )
    .addOption(
      new Option(
        '--src-prefix <relative-path>',
        `Path relative to the --local-dir where the ${MAKECOMAPP_FILENAME} file is located (default: src)`,
      ).default('src'),
    )
    .addHelpText(
      'after',
      `Examples:\n  ${program.name()} pull --local-dir ./my-app\n --src-prefix src    - Pulls all components from Make into ./my-app/src, updating existing and adding new ones.`,
    )
    .action(async function () {
      const cliOptions = this.opts() as { localDir: string; srcPrefix: string };
      storeCurrentCliContext('pull', {}, cliOptions);

      const localAppRootdir = Uri.file(path.join(cliOptions.localDir, cliOptions.srcPrefix)) as unknown as any; // IVscode.Uri

      // Select origin (uses CLI-compatible vscode lib wrapper)
      const origin = await askForProjectOrigin(localAppRootdir);
      if (!origin) {
        return; // user cancelled
      }

      const originChecksums = await downloadOriginChecksums(origin);

      await pullAllComponents(localAppRootdir, origin, 'askUser', originChecksums);
    });
}
