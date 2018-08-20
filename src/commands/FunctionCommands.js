const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')

class FunctionCommands {
    static async register(appsProvider, _authorization, _environment){
        
        /**
         * New function
         */
        vscode.commands.registerCommand('apps-sdk.function.new', async function (context) {

            // If called out of context -> die
            if(!Core.contextGuard(context)){ return }

            // Get the source app
            let app = context.parent

            // Prompt for the function name
            let name = await vscode.window.showInputBox({
                prompt: "Enter function name",
                ignoreFocusOut: false,
                validateInput: Validator.functionName
            })

            // If not filled -> die
            if(!Core.isFilled("name", "function", name)){ return }

            // Add the new entity. Refresh the tree or show the error
            try{
                await Core.addEntity(_authorization, { "name": name }, `${_environment}/app/${app.name}/${app.version}/function`)
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
    }
}

module.exports = FunctionCommands