const vscode = require('vscode')

class VariablesProvider {
    constructor(variables) {
        this.variables = variables
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