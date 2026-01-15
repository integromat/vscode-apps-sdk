import * as path from 'node:path';
import { Command, Option } from 'commander';
import { createLocalEmptyComponent } from '../../local-development/create-local-empty-component';
import { vscodeLibWrapperFactory } from '../../services/vscode-lib-wraper';
import { storeCurrentCliContext } from '../cli-context';
import type { ModuleType } from '../../types/component-types.types';
import type { Crud } from '../../local-development/types/crud.types';
import { optionalAddModuleToDefaultGroup } from '../../local-development/groups-json';
import fs from 'fs';

const vscode = vscodeLibWrapperFactory.lib;

export function registerCreateModuleCommand(program: Command): void {

	console.log("create-module");

	program.command('create-module')
		.description('Creates a new local module in the current Make app project.')
		.addOption(new Option('--module-id <string>', 'The local ID of the new module.').makeOptionMandatory(true))
		.addOption(new Option('--label <string>', 'The label (title) of the new module.').makeOptionMandatory(true))
		.addOption(new Option('--description <string>', 'The description of the new module.').makeOptionMandatory(true))

		.addOption(
			new Option('--type <string>', 'The type of the module.')
				.choices(['trigger', 'action', 'search', 'instant_trigger', 'responder', 'universal'])
				.makeOptionMandatory(true),
		)
		.addOption(
			new Option('--crud <string>', 'The CRUD type of the action module.')
				.choices(['create', 'read', 'update', 'delete']),
		)
		.addOption(new Option('--connection <string>', 'The local ID of the connection to link.'))
		.addOption(new Option('--alt-connection <string>', 'The local ID of the alternative connection to link.'))
		.addOption(new Option('--webhook <string>', 'The local ID of the webhook to link (mandatory for instant triggers).'))
		.addOption(
			new Option('--local-dir <filesystem-path>', 'The directory where the app will be cloned to.')
				.makeOptionMandatory(true)
				.argParser((value: string) => {
					const absPath = path.resolve(value);

					fs.mkdirSync(absPath, { recursive: true });
					const stat = fs.statSync(absPath);

					// Must be a directory.
					if (!stat.isDirectory()) {
						throw new Error(`The directory "${absPath}" is not a directory.`);
					}
					return absPath;
				}),
		)
		.addOption(
			new Option(
				'--src-prefix <relative-path>',
				`Path relative to the --local-dir where the makecomapp.json file is located (default: src)`,
			).default('src'),
		)
		.action(async function (options) {
			storeCurrentCliContext('create-module', {}, options);

			console.log(options.localDir);
			const makeappRootDir = vscode.Uri.file(path.resolve(path.join(options.localDir, options.srcPrefix)));
			console.log(makeappRootDir);

			if (options.type === 'action' && !options.crud) {
				throw new Error('CRUD type is required for action modules. Use --crud <create|read|update|delete>');
			}

			if (options.type === 'instant_trigger' && !options.webhook) {
				throw new Error('Webhook ID is required for instant trigger modules. Use --webhook <webhook-id>');
			}

			const moduleMetadata = {
				label: options.label,
				description: options.description,
				moduleType: options.type as ModuleType,
				actionCrud: options.crud as Crud,
				connection: options.connection || null,
				altConnection: options.altConnection || null,
				webhook: options.webhook || null,
			};

			const newModule = await createLocalEmptyComponent('module', options.moduleId, moduleMetadata, makeappRootDir);

			// Update groups.json (if file is filled/used)
			await optionalAddModuleToDefaultGroup(makeappRootDir, newModule.componentLocalId);

			console.log(`Module "${newModule.componentLocalId}" successfully created locally.`);
		});
}
