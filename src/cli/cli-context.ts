/**
 * @module CliContext
 *
 * Provides a centralized context for the CLI mode.
 *
 * Context = all details about the command line arguments and options defined in current CLI execution
 */

const _currentCliContext = {
	command: '',
	arguments: {} as Record<string, string | number | boolean>,
	options: {} as Record<string, string | number | boolean>,
};

/**
 * Allows to access the current CLI command name, arguments and options for any other module.
 */
export function getCurrentCliContext() {
	return _currentCliContext;
}

/**
 * Store the current CLI command name, arguments and options.
 * Then, any other module can access the context using getCurrentCliContext() function.
 */
export function storeCurrentCliContext(cliMainCommand: string, cliArguments: Record<string, string | number | boolean>, cliOptions: Record<string, string | number | boolean>) {
	_currentCliContext.command = cliMainCommand;
	_currentCliContext.arguments = cliArguments;
	_currentCliContext.options = cliOptions;
}
