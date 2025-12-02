/**
 * @module Commander
 *
 * Provides a centralized command line argument parser for the CLI mode.
 *
 */

import { Command } from 'commander';
import { registerCloneCommand } from './commands/clone';
import { registerDeployCommand } from './commands/deploy';
import { registerPullCommand } from './commands/pull';

export const cliProgram = new Command();

cliProgram.name('make-cli').description('A CLI tool for local development and deployment of Make.com Custom Apps.');

// Register sub-commands (split into single tools)
registerCloneCommand(cliProgram);
registerDeployCommand(cliProgram);
registerPullCommand(cliProgram);
