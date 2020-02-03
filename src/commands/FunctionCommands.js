const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')

const { VM, VMScript } = require('vm2')
const { IML } = require('@integromat/iml')

class FunctionCommands {
	static async register(appsProvider, _authorization, _environment, _timezone) {

		var outputChannel = vscode.window.createOutputChannel("IML tests")

        /**
         * New function
         */
		vscode.commands.registerCommand('apps-sdk.function.new', async function (context) {

			// If called out of context -> die
			if (!Core.contextGuard(context)) { return }

			// Get the source app
			let app = context.parent

			// Prompt for the function name
			let name = await vscode.window.showInputBox({
				prompt: "Enter function name",
				ignoreFocusOut: false,
				validateInput: Validator.functionName
			})

			// If not filled -> die
			if (!Core.isFilled("name", "function", name)) { return }

			// Add the new entity. Refresh the tree or show the error
			try {
				await Core.addEntity(_authorization, { "name": name }, `${_environment}/app/${app.name}/${app.version}/function`)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Run function test
         */
		vscode.commands.registerCommand('apps-sdk.function.test', async function (context) {

			let urn
			let functionName

			// If called out of context -> gather the required information
			if (context === undefined || context === null) {
				let crumbs
				// If a window is open
				if (!vscode.window.activeTextEditor) {
					vscode.window.showErrorMessage("Active text editor not found.")
					return
				}
				// If an apps file is open
				if (!vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1]) {
					vscode.window.showErrorMessage("Opened file doesn't belong to Apps SDK.")
					return
				}
				// Parse the path
				crumbs = vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1].split('/').reverse()
				// If crumbs were parsed
				if (!crumbs) {
					vscode.window.showErrorMessage("The path was not parsed successfully.")
					return
				}
				// If the path hasn't 7 crumbs it's definitely not a function
				if (crumbs.length !== 7) {
					vscode.window.showErrorMessage("The parsed path doesn't lead to function.")
					return
				}
				// If the path doesn't contain required crumbs
				if (!((crumbs[0] === "test.js" || crumbs[0] === "code.js") && crumbs[2] === "function" && crumbs[5] === "app")) {
					vscode.window.showErrorMessage("The parsed path doesn't correspond to the function test schema.")
					return
				}
				// If all checks passed, set URN
				urn = `${_environment}/app/${crumbs[4]}/${crumbs[3]}/function`
				functionName = `${crumbs[1]}`
			}

			// Else parse from context
			else {
				// Set correct URN (if called from function or core or test)
				urn = `${_environment}/app/${Core.getApp(context).name}/${Core.getApp(context).version}/function`
				if (context.supertype === "function") {
					functionName = `${context.name}`
				}
				else if (context.name === "code" || context.name === "test") {
					functionName = `${context.parent.name}`
				}
			}

			// Get current function code
			let code = await Core.rpGet(`${urn}/${functionName}/code`, _authorization)

			// Get current test code
			let test = await Core.rpGet(`${urn}/${functionName}/test`, _authorization)

			// Get users' functions
			let userFunctions = await Core.rpGet(`${urn}`, _authorization, { code: true })

			// Merge codes
			let codeToRun = `${code}\r\n\r\n/* === TEST CODE === */\r\n\r\n${test}`

            /**
             *  Sandbox cookbook
             *  - Assert for assertions
             *  - IML for internal IML functions
             *  - Users' IML functions
             */
			let success = 0
			let fail = 0
			let total = 0
			let sandbox = {
				assert: require('assert'),
				iml: {},
				it: (name, test) => {
					total++
					outputChannel.append(`- ${name} ... `)
					try {
						test()
						outputChannel.appendLine(`✔`)
						success++
					}
					catch (err) {
						outputChannel.appendLine(`✘ => ${err}`)
						fail++
					}
				},
				environment: {
					timezone: _timezone
				}
			};

			Object.keys(IML.FUNCTIONS).forEach(name => {
				sandbox.iml[name] = IML.FUNCTIONS[name].value.bind({ timezone: sandbox.environment.timezone });
			});

			outputChannel.clear()
			outputChannel.appendLine(`======= STARTING IML TEST =======\r\nFunction: ${functionName}\r\n---------- IN PROGRESS ----------`)

			// Prepare VM2, set timeout and pass sandbox
			const vm = new VM({
				timeout: 5000,
				sandbox: sandbox
			})

			vm.prepare = vm.run('(function(args) { global.__arguments__ = args })');

			userFunctions.forEach(func => {
				const preCompiled = new VMScript(`(${func.code}).apply({timezone: environment.timezone}, __arguments__)`, func.name);
				sandbox.iml[func.name] = (...args) => {
					vm.prepare(args);
					return vm.run(preCompiled);
				};
			});

			// Show output channel IML tests and try running the test code
			outputChannel.show()
			try {
				vm.run(codeToRun)
				outputChannel.appendLine(`----------- COMPLETED -----------`)
				outputChannel.appendLine(`Total test blocks: ${total}`)
				outputChannel.appendLine(`Passed blocks: ${success}`)
				outputChannel.appendLine(`Failed blocks: ${fail}`)
				if (fail === 0) {
					outputChannel.appendLine(`========== TEST PASSED ==========`)
				}
				else {
					outputChannel.appendLine(`========== TEST FAILED ==========`)
				}
			}
			catch (err) {
				outputChannel.appendLine(`========= CRITICAL FAIL =========`)
				outputChannel.appendLine(err)
			}
		})
	}
}

module.exports = FunctionCommands