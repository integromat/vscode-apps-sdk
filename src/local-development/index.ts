import * as compareFileModule from './compare-file';
import * as deployModule from './deploy';
import * as cloneModule from './clone';
import * as createLocalConnection from './create-local-connection';
import * as createLocalWebhook from './create-local-webhook';
import * as createLocalModule from './create-local-module';
import * as createLocalRpc from './create-local-rpc';
import * as createLocalImlFunction from './create-local-imlfunction';
import * as pullModule from './pull';

/**
 * Registers all necessary VS Code Extension commands of feature "Local Development for Apps".
 */
export function registerCommandForLocalDevelopment(): void {
	compareFileModule.registerCommands();
	deployModule.registerCommands();
	cloneModule.registerCommands();
	createLocalConnection.registerCommands();
	createLocalWebhook.registerCommands();
	createLocalModule.registerCommands();
	createLocalRpc.registerCommands();
	createLocalImlFunction.registerCommands();
	pullModule.registerCommands();
}
