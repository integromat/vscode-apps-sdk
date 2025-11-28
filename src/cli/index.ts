#!/usr/bin/env node

// Use CLI implementation of `vscode` wrapper
import { ideCliMode } from '../services/ide-or-cli-mode';
ideCliMode.mode = 'cli'; // Must be set BEFORE importing other libs

process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',app:*' : 'app:*';

import { cliProgram } from './commander';

async function mainCli() {
	cliProgram.parse(process.argv);
}

mainCli();
