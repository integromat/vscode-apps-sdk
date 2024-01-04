const vscode = require('vscode');

class RpcProvider{
	constructor(rpcs){
		this.rpcs = rpcs;
	}

	resolveCompletionItem(item){
		return item;
	}

	provideCompletionItems(){
		return this.rpcs.map(rpc => {
			return new vscode.CompletionItem(rpc, vscode.CompletionItemKind.Function);
		});
	}
}

module.exports.RpcProvider = RpcProvider;
