import * as compareFileModule from './compare-file';
import * as deployModule from './deploy'
import * as cloneModule from './clone';
import * as createLocalConnection from './create-local-connection';
import * as createLocalModule from './create-local-module';
import * as pullModule from './pull';

/**
 * Registers all necessary VS Code Extension commands of feature "Local SDK Apps development".
 */
export function registerCommandForLocalDevelopment(): void {
	compareFileModule.registerCommands();
	deployModule.registerCommands();
	cloneModule.registerCommands();
	createLocalConnection.registerCommands();
	createLocalModule.registerCommands();
	pullModule.registerCommands();
}
