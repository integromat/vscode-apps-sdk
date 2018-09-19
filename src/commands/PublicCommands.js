const vscode = require('vscode')

class PublicCommands {
    static async register() {
        vscode.commands.registerCommand('apps-sdk.help', async function () {
            let crumbs
            // If a window is open
            if (vscode.window.activeTextEditor) {
                // If an apps file is open
                if (vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1]) {
                    // Parse the path
                    crumbs = vscode.window.activeTextEditor.document.uri.fsPath.split('apps-sdk')[1].split('/').reverse()
                }
            }

            let docsbase = 'https://docs.integromat.com/apps/'
            let options = [
                {
                    "label": "Integromat Apps",
                    "description": docsbase
                }
            ]
            // If crumbs were parsed
            if (crumbs) {
                // If six or seven crumbs -> connection, webhook, module, rpc or function
                if ([6, 7].includes(crumbs.length)) {

                    // Set function to iml-function because of docs path
                    let pathCrumb = crumbs[2] === "function" ? "iml-function" : crumbs[2]

                    // Add option to open general docs for a module, function, ...
                    options.unshift({
                        "label": `${crumbs[2].charAt(0).toLocaleUpperCase()}${crumbs[2].slice(1)} docs`,
                        "description": `${docsbase}app-structure/${pathCrumb}s`
                    })

                    // Locate a code-item
                    crumbs[0] = crumbs[0].split('.')[0]

                    // Set custom path for connections' common
                    pathCrumb = crumbs[0] === "common" ? "other-subblocks/connections-common-data" : crumbs[0]

                    // Exclude code and test of function, they don't have their own page
                    if (!['code', 'test'].includes(pathCrumb)) {

                        // Add option to open detailed docs
                        options.unshift({
                            "label": `${crumbs[0].charAt(0).toLocaleUpperCase()}${crumbs[0].slice(1)} docs`,
                            "description": `${docsbase}structure-blocks/${pathCrumb}`
                        })
                    }
                }

                // If five crumbs -> base, common or docs
                else if (crumbs.length === 5) {

                    // Locate a code-item
                    crumbs[0] = crumbs[0].split('.')[0]

                    // If it's apps' base or common
                    if (['base', 'common'].includes(crumbs[0])) {

                        // Add option to open detailed docs
                        options.unshift({
                            "label": `${crumbs[0].charAt(0).toLocaleUpperCase()}${crumbs[0].slice(1)} docs`,
                            "description": `${docsbase}app-structure/general/${crumbs[0]}`
                        })
                    }
                }
            }
            let answer = await vscode.window.showQuickPick(options, { placeHolder: "Choose a docs page you want to open" })
            if (answer === undefined || answer === null) {
                vscode.window.showWarningMessage("No answer has been recognized.")
                return
            }
            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(answer.description))
        })
    }
}

module.exports = PublicCommands