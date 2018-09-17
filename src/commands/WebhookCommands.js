const vscode = require('vscode')

const Core = require('../Core')
const QuickPick = require('../QuickPick')
const Enum = require('../Enum')

class WebhookCommands {
    static async register(appsProvider, _authorization, _environment){

        /**
         * New webhook
         */
        vscode.commands.registerCommand('apps-sdk.webhook.new', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent

            // Label prompt
            let label = await vscode.window.showInputBox({ prompt: "Enter webhook label" })
            if(!Core.isFilled("label", "webhook", label)){ return }

            // Type prompt
            let type = await vscode.window.showQuickPick(Enum.webhookTypes)
            if(!Core.isFilled("type", "webhook", type)){ return }

            // Connections prompt (decide if compulsory or not)
            let connections
            switch (type.description) {
                case "web":
                    connections = QuickPick.connections(_environment, _authorization, app, true)
                    break
                case "web-shared":
                    connections = QuickPick.connections(_environment, _authorization, app, false)
                    break
            }
            let connection = await vscode.window.showQuickPick(connections)
            if(!Core.isFilled("connection", "webhook", connection)){ return }

            // Build URI and prepare connection value
            let uri = `${_environment}/app/${app.name}/webhook`
            connection = connection.label === "--- Without connection ---" ? "" : connection.description

            // Send the request
            try{
                await Core.addEntity(_authorization, {
                    "label": label,
                    "type": type.description,
                    "connection": connection
                }, uri)
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Edit webhook
         */
        vscode.commands.registerCommand('apps-sdk.webhook.edit-metadata', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }

            // Label prompt with prefilled value
            let label = await vscode.window.showInputBox({
                prompt: "Customize webhook label",
                value: context.label
            })
            if(!Core.isFilled("label", "webhook", label)){ return }

            // Send the request
            try{
                await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/label`)
                appsProvider.refresh()
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })

        /**
         * Change webhook connection
         */
        vscode.commands.registerCommand('apps-sdk.webhook.change-connection', async function (context){

            //Context check
            if(!Core.contextGuard(context)){ return }

            // Prepare connections -> determine if required or not
            let connections
            switch (context.type) {
                case "web":
                    connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
                    break
                case "web-shared":
                    connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, false)
                    break
            }
            connections = [{ label: "Don't change", description: "keep" }].concat(connections)

            // Prompt for connection
            let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
            if(!Core.isFilled("connection", "webhook", connection)){ return }

            // Send the request
            try{
                if (connection.description !== "keep") {
                    connection = connection.label === "--- Without connection ---" ? "" : connection.description
                    await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/connection`)
                    appsProvider.refresh()
                }
            }
            catch(err){
                vscode.window.showErrorMessage(err.error.message || err)
            }
        })
    }
}

module.exports = WebhookCommands