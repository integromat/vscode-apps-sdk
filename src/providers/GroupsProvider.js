const vscode = require('vscode')

class GroupsProvider {
	constructor(source) {
		this.availableModules = [];
		this.source = source
	}

	resolveCompletionItem(item) {
		return item
	}

	provideCompletionItems() {
		return this.availableModules;
	}

	buildCompletionItems() {
		this.availableModules = this.source.map(module => {
			let item = new vscode.CompletionItem(module.name, vscode.CompletionItemKind.Function)
			item.label = module.label
			item.insertText = module.name
			return item
		})
	}
}

module.exports = GroupsProvider