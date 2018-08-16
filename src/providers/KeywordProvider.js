const vscode = require('vscode')

var keywords = [
    "url",
    "encodeUrl",
    "method",
    "qs",
    "headers",
    "body",
    "type",
    "ca",
    "condition",
    "temp",
    "oauth",
    "aws",
    "response",
    "pagination",
    "type",
    "iterate",
    "trigger",
    "output",
    "wrapper",
    "valid",
    "error",
    "container"
]

class KeywordProvider{
    constructor(){
        this.items = keywords.map(item => {
            return new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword)
        })
    }

    resolveCompletionItem(item){
        return item
    }

    provideCompletionItems(){
        return this.items
    }
}

module.exports = KeywordProvider