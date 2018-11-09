const vscode = require('vscode')

const Core = require('../Core');
const { IML } = require('@integromat/iml')

class StaticImlProvider {
    constructor() {
        this.availableFunctions = []
    }

    async initialize() {
        let dictionary = JSON.parse((await Core.rpGet("https://static.integromat.com/lang/imt.iml.en.js ")).match(/({.+})/gm));
        let keys = Object.keys(IML.FUNCTIONS)
        keys = keys.filter(key => {
            return key === "" ? false : true
        })
        let availableFunctions = keys.map(name => {
            let f = IML.FUNCTIONS[name];
            let item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function)
            if (Array.isArray(f.group)) {
                let parts = []
                for (let group of f.group) {
                    let details = dictionary[group].functions[name]
                    if (details !== undefined) {
                        parts.push(details.help || "")
                    }
                }
                let toMarkdown = parts.join("\n\n------------\n\n")
                item.documentation = new vscode.MarkdownString(toMarkdown)
            }
            else {
                let details = dictionary[f.group].functions[name]
                if (details !== undefined) {
                    item.documentation = new vscode.MarkdownString(details.help || "")
                }
            }
            item.insertText = `${name}()`
            item.detail = `${f.value.toString().replace(/{(.|\n)+}/gm, '{ ... }')}: ${f.type}`
            return item
        })
        this.availableFunctions = availableFunctions
    }

    resolveCompletionItem(item) {
        return item
    }

    provideCompletionItems() {
        return this.availableFunctions
    }

}

module.exports = StaticImlProvider