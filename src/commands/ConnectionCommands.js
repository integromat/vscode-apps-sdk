const vscode = require('vscode')

const Core = require('../Core')
const Enum = require('../Enum')

class ConnectionCommands {
    static async register(appsProvider, _authorization, _environment){

        /**
         * New connection
         */
        vscode.commands.registerCommand('apps-sdk.connection.new', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter connection label" })
            if(!Core.isFilled("label", "connection", label)){ return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.connectionTypes)
            if(!Core.isFilled("type", "connection", type)){ return }

            // Prepare URI
            let uri = `${_environment}/app/${app.name}/connection`

            // Send the request
            try{
                await Core.addEntity(_authorization, {
                    "label": label,
                    "type": type.description
                }, uri)
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Edit connection
         */
        vscode.commands.registerCommand('apps-sdk.connection.edit-metadata', async function (context) {

            // Context check
            if (!Core.contextGuard(context)) { return }

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize connection label",
                value: context.label
            })
            if(!Core.isFilled("label", "connection", label)){ return }

            // Build URI
            let uri = `${_environment}/app/${context.parent.parent.name}/connection/${context.name}/label`

            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, uri)
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
    }
}

module.exports = ConnectionCommands