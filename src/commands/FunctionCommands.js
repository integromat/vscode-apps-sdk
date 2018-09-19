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

            // If called out of context -> die
            if (!Core.contextGuard(context)) { return }

            // Set correct URN (if called from function or core or test)
            let urn
            let functionLabel
            if (context.supertype === "function") {
                urn = `${_environment}/app/${Core.getApp(context).name}/${Core.getApp(context).version}/function/${context.name}`
                functionLabel = context.label
            }
            else if (context.name === "code" || context.name === "test") {
                urn = `${_environment}/app/${Core.getApp(context).name}/${Core.getApp(context).version}/function/${context.parent.name}`
                functionLabel = context.parent.label
            }

            // Get current function code
            let code = await Core.rpGet(`${urn}/code`, _authorization)

            // Get current test code
            let test = await Core.rpGet(`${urn}/test`, _authorization)

            // Get users' functions
            let userFunctions = await Core.rpGet(`${_environment}/app/${Core.getApp(context).name}/${Core.getApp(context).version}/function`, _authorization, { code: true })

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
            outputChannel.appendLine(`======= STARTING IML TEST =======\r\nFunction: ${functionLabel}\r\n---------- IN PROGRESS ----------`)

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

            functionLabel = context.label
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