const vscode = require('vscode')

const Core = require('../Core')

const rp = require('request-promise')

class VariablesProvider {
    constructor(_authorization, _environment) {
        this._authorization = _authorization
        this._environment = _environment
        this.availableParameters = []
        this.variables = []
    }

    async loadVariables(crumbs, version) {

        // Preparing api route
        let urn = `/app/${crumbs[2]}`
        if (Core.isVersionable(crumbs[3])) {
            urn += `/${version}`
        }
        urn += `/${crumbs[3]}/${crumbs[4]}`

        /*
         * PARAMETERS
         */
        if (["connection", "webhook", "rpc", "module"].includes(crumbs[3])) {
            let url = `${this._environment}${urn}/parameters`
            let parameters = await rp({
                url: url,
                headers: {
                    'Authorization': this._authorization
                }
            }).catch(err => {
                vscode.window.showErrorMessage(err.error.message || err)
            })
            this.availableParameters = this.generateParametersMap(JSON.parse(parameters), "parameters")
        }

        /*
         * EXPECT
         */
        if (crumbs[3] === "module") {
            let url = `${this._environment}${urn}/expect`
            let expect = await rp({
                url: url,
                headers: {
                    'Authorization': this._authorization
                }
            }).catch(err => {
                vscode.window.showErrorMessage(err.error.message || err)
            })
            this.availableParameters = this.availableParameters.concat(this.generateParametersMap(JSON.parse(expect), "parameters"))
        }

        this.variables = this.availableParameters.map(parameter => { return new vscode.CompletionItem(parameter, vscode.CompletionItemKind.Variable) })
    }

    generateParametersMap(parameters, root) {
        let out = []
        parameters.forEach(parameter => {
            out.push(`${root}.${parameter.name}`)
            if (Array.isArray(parameter.nested)) {
                out = out.concat(this.generateParametersMap(parameter.nested, root))
            }
            if (parameter.type === "collection" && Array.isArray(parameter.spec)) {
                out = out.concat(this.generateParametersMap(parameter.spec, `${root}.${parameter.name}`))
            }
            else if (parameter.type === "select" && Array.isArray(parameter.options)) {
                parameter.options.forEach(option => {
                    if (Array.isArray(option.nested)) {
                        out = out.concat(this.generateParametersMap(option.nested, root))
                    }
                })
            }
        })
        return out
    }

    resolveCompletionItem(item) {
        return item
    }

    provideCompletionItems() {
        return this.variables
    }
}

module.exports = VariablesProvider