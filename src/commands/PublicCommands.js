const vscode = require('vscode')

class PublicCommands {
    static async register() {
        vscode.commands.registerCommand('apps-sdk.help', async function (context) {
            console.log(context)
        })
    }
}

module.exports = PublicCommands