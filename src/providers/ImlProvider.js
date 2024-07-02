const vscode = require('vscode');

class ImlProvider{
	constructor(functions){
		this.functions = functions;
	}

	resolveCompletionItem(item){
		return item;
	}

	provideCompletionItems(){
		return this.functions.map(f => {
			return new vscode.CompletionItem(f, vscode.CompletionItemKind.Function);
		});
	}
}

module.exports.ImlProvider = ImlProvider;
