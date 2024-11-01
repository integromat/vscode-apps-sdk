import * as vscode from 'vscode';

/**
 * Helper for autocompletion of available app's custom IML functions.
 */
export class ImlProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {
	/**
	 * @param functions List of all App Custom IML function names
	 */
	constructor(private readonly functions: string[]) {}

	resolveCompletionItem(
		item: vscode.CompletionItem,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.CompletionItem> {
		return item;
	}

	provideCompletionItems(
		_document: vscode.TextDocument,
		_position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
		return this.functions.map((f) => {
			return new vscode.CompletionItem(f, vscode.CompletionItemKind.Function);
		});
	}
}
