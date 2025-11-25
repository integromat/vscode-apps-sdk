/**
 * @module Commander
 *
 * Provides a centralized command line argument parser for the CLI mode.
 *
 */

import { Command } from 'commander';
import { registerCloneCommand } from './commands/clone';
import { registerDeployCommand } from './commands/deploy';

export const cliProgram = new Command();

cliProgram.name('makeapps-cli').description('A CLI tool for local development and deployment of Make.com Custom Apps.');

// Register sub-commands (split into single tools)
registerCloneCommand(cliProgram);
registerDeployCommand(cliProgram);
