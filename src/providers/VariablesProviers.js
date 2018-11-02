const vscode = require('vscode')

const Core = require('../Core')

const rp = require('request-promise')

class VariablesProvider {
    constructor(_authorization, _environment) {
        this._authorization = _authorization
        this._environment = _environment
    }

    async loadVariables(crumbs, version) {

        // Preparing api route
        let urn = `/app/${crumbs[2]}`
        if (Core.isVersionable(crumbs[3])) {
            urn += `/${version}`
        }
        urn += `/${crumbs[3]}/${crumbs[4]}`

        //TODO: Create logic - nothing - parameters - par+exp
        // Getting parameters
        let url = `${this._environment}${urn}/parameters`
        let parameters = await rp({
            url: url,
            headers: {
                'Authorization': this._authorization
            }
        }).catch(err => {
            vscode.window.showErrorMessage(err.error.message || err)
        })

    }

    resolveCompletionItem(item) {
        return item
    }

    provideCompletionItems() {
        return this.variables.map(variable => {
            return new vscode.CompletionItem(variable, vscode.CompletionItemKind.Variable)
        })
    }
}

module.exports = VariablesProvider