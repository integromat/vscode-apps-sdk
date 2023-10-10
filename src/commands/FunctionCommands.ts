import * as vm from 'node:vm';
import * as assert from 'node:assert';
import { setTimeout } from 'node:timers/promises';
import { IML } from '@integromat/iml';
import * as vscode from 'vscode';
import * as Core from '../Core';
import * as Validator from '../Validator';
import { catchError } from '../error-handling';
import { Environment } from '../types/environment.types';
import AppsProvider from '../providers/AppsProvider';

export class FunctionCommands {
	static async register(
		appsProvider: AppsProvider, _authorization: string, _environment: Environment, _timezone: string
	) {

		const outputChannel = vscode.window.createOutputChannel('IML tests')

		/**
		 * New function
		 */
		vscode.commands.registerCommand('apps-sdk.function.new', catchError('Function creation', async (context) => {

			// If called out of context -> die
			if (!Core.contextGuard(context)) { return }

			// Get the source app
			const app = context.parent

			// Prompt for the function name
			const name = await vscode.window.showInputBox({
				prompt: 'Enter function name',
				ignoreFocusOut: false,
				validateInput: Validator.functionName
			})

			// If not filled -> die
			if (!Core.isFilled('name', 'function', name)) { return }

			// Add the new entity. Refresh the tree or show the error
			await Core.addEntity(_authorization, { name: name }, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/${Core.pathDeterminer(_environment.version, 'function')}`)
			appsProvider.refresh()
		}));

		/**
		 * Run function test
		 */
		vscode.commands.registerCommand('apps-sdk.function.test', async function (context) {

			let urn: string;
			let functionName: string;

			// If called out of context -> gather the required information
			if (context === undefined || context === null) {
				// If a window is open
				if (!vscode.window.activeTextEditor) {
					vscode.window.showErrorMessage('Active text editor not found.')
					return
				}
				// If an apps file is open
				if (!vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1]) {
					vscode.window.showErrorMessage("Opened file doesn't belong to Apps SDK.")
					return
				}
				// Parse the path
				const crumbs = vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1].split('/').reverse()
				// If crumbs were parsed
				if (!crumbs) {
					vscode.window.showErrorMessage('The path was not parsed successfully.')
					return
				}
				// If the path hasn't 8 or 7 crumbs it's definitely not a function
				if (crumbs.length !== 8 && crumbs.length !== 7) {
					vscode.window.showErrorMessage("The parsed path doesn't lead to function.")
					return
				}
				// If the path doesn't contain required crumbs
				if (!((crumbs[0] === 'test.js' || crumbs[0] === 'code.js') && (crumbs[2] === 'function' || crumbs[2] === 'functions') && (crumbs[5] === 'app' || crumbs[5] === 'apps'))) {
					vscode.window.showErrorMessage("The parsed path doesn't correspond to the function test schema.")
					return
				}
				// If all checks passed, set URN
				urn = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${crumbs[4]}/${crumbs[3]}/${Core.pathDeterminer(_environment.version, 'function')}`
				functionName = `${crumbs[1]}`
			}

			// Else parse from context
			else {
				// Set correct URN (if called from function or core or test)
				urn = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.getApp(context).name}/${Core.getApp(context).version}/${Core.pathDeterminer(_environment.version, 'function')}`
				if (context.supertype === 'function') {
					functionName = `${context.name}`
				}
				else if (context.name === 'code' || context.name === 'test') {
					functionName = `${context.parent.name}`
				} else {
					throw new Error('Internal error: Unexpected state, cannot resolve the "functionName".');
				}
			}

			// Get current test code
			const test = await Core.rpGet(`${urn}/${functionName}/test`, _authorization)

			// Get all custom IML functions (includes the tested one)
			let userFunctions: CustomImlFunction[] = await Core.rpGet(`${urn}`, _authorization, { code: true, cols: ['name', 'code'] })
			if (_environment.version === 2) {
				userFunctions = (<any>userFunctions).appFunctions;
			}

			// Merge codes

			await executeCustomFunctionTest(functionName, test, userFunctions, outputChannel, _timezone);

		})
	}
}

/**
 * Executes unit tests (param `testCode`) of custom function (param `customFunctionCode`) in separate context
 * and pushes the result into `outputChannel` as user-friendly report.
 */
export async function executeCustomFunctionTest(
	functionNameForTesting: string, testCode: string,
	allCustomImlFunctions: CustomImlFunction[], outputChannel: vscode.OutputChannel, _timezone: string
) {
	/**
	 *  Sandbox cookbook
	 *  - Assert for assertions
	 *  - IML for internal IML functions
	 *  - Users' IML functions
	 */
	let success = 0
	let fail = 0
	let total = 0

	const sandbox: vm.Context = {
		assert: assert,
		// Add build-in IML functions as global `iml.[functionName]`
		iml: Object.fromEntries(Object.entries(IML.FUNCTIONS).map(([name, func]) => [
			name,
			func.value.bind({ timezone: _timezone })
		])),
		it: (name: string, test: () => void) => {
			total++;
			outputChannel.append(`- ${name} ... `);
			try {
				test();
				outputChannel.appendLine('✔');
				success++;
			} catch (err) {
				outputChannel.appendLine(`✘ => ${err}`);
				fail++;
			}
		},
		environment: {
			timezone: _timezone,
		},
	};

	outputChannel.clear();
	outputChannel.show();

	outputChannel.appendLine(
		'======= STARTING IML TEST =======\r\n' +
		`Function: ${functionNameForTesting}\r\n` +
		'---------- IN PROGRESS ----------',
	);
	// Give a time to display the output log
	await setTimeout();

	// Prepare the separate context
	vm.createContext(sandbox);

	// Make all other user functions available in the isolation,
	// because the tested function can call other functions anytime.
	const customImlFunctionsCode = allCustomImlFunctions
		.map((userFunction) => {
			return `iml['${userFunction.name}'] = function (...arguments) {` +
				`    return (${userFunction.code}).apply({timezone: environment.timezone}, arguments); ` +
				'};';
		})
		.join('\n\n');
	vm.runInContext(customImlFunctionsCode, sandbox, { timeout: 2000 });

	// Execute the test
	try {
		// Make the tested function available in global scope (without `iml.` prefix)
		vm.runInContext(`const ${functionNameForTesting} = iml.${functionNameForTesting};`, sandbox, { timeout: 1000 });
		// Execute tests
		vm.runInContext(testCode, sandbox, { timeout: 5000 });
		outputChannel.appendLine('----------- FINISHED -----------');
		outputChannel.appendLine(`Total test blocks: ${total}`);
		outputChannel.appendLine(`Passed blocks: ${success}`);
		outputChannel.appendLine(`Failed blocks: ${fail}`);
		if (fail === 0) {
			outputChannel.appendLine('========== ✔ TEST PASSED ==========')
		}
		else {
			outputChannel.appendLine('========== ✘ TEST FAILED ==========')
		}
	}
	catch (err: any) {
		outputChannel.appendLine(' ✘ EXECUTION CRITICAL FAILURE');
		outputChannel.appendLine(`${err.name}: ${err.message}`);
	}
}

export interface CustomImlFunction {
	/** @example 'myImlFunc1' */
	name: string;
	/** @example "function myImlFunc1(a, b) { return a+b; }" */
	code: string;
}
