const vscode = require('vscode')

const Core = require('../Core')
const Enum = require('../Enum')

const rp = require('request-promise')

class CommonCommands {
    static async register(appsProvider, _authorization, _environment){

        /**
         * Delete entity
         */
        vscode.commands.registerCommand('apps-sdk.delete', async function (context) {

            // Context check
            if(!Core.contextGuard(context)){ return }
            let app = context.parent.parent

            // Wait for confirmation
            let answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete this ${context.apiPath} ?` })
            if(answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }

            // If confirmed or not
            switch(answer.label){
                case "No":
                    vscode.window.showInformationMessage(`Stopped. No ${context.apiPath || context.supertype}s were deleted.`)
                    break

                case "Yes": 
                    // Set URI and send the request
                    context.apiPath = context.apiPath === undefined ? context.supertype : context.apiPath
                    let uri = Core.isVersionable(context.apiPath) ? `${_environment}/app/${app.name}/${app.version}/${context.apiPath}/${context.name}` : `${_environment}/app/${app.name}/${context.apiPath}/${context.name}`
                    try{
                        await rp({
                            method: 'DELETE',
                            uri: uri,
                            headers: {
                                Authorization: _authorization
                            },
                            json: true
                        })
                        appsProvider.refresh()
                    }
                    catch(err){
                        vscode.window.showErrorMessage(err.error.message || err)
                    }
                    break
            }
        })

        /**
         * Refresh
         */
        vscode.commands.registerCommand('apps-sdk.refresh', function () {
            appsProvider.refresh();
        })
    }
}

module.exports = CommonCommands