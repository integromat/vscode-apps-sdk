import * as downloadFileModule from './download-file';
import * as deployModule from './deploy'
import * as cloneModule from './clone';
import * as createConnectionModule from './create-connection';
import * as pullModule from './pull';

/**
 * Registers all necessary VS Code Extension commands of feature "Local SDK Apps development".
 */
export function registerCommandForLocalDevelopment(): void {
	downloadFileModule.registerCommands();
	deployModule.registerCommands();
	cloneModule.registerCommands();
	createConnectionModule.registerCommands();
	pullModule.registerCommands();
}
