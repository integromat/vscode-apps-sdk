import * as vscode from 'vscode';
import { IML, imlDocumentation, ImlDocumentation } from '@integromat/iml';

/**
 * Caches the list of available IML functions in format, which is consumed by VS Code SDK.
 * Cache avoids the multiple processing (spends CPU, RAM) of same data.
 *
 * Filled at first usage.
 */
let availableImlFunctionsDocCache: ReturnType<typeof getAvailableImlFunctionsDoc> | undefined = undefined;

/**
 * Helper for autocompletion of available Make IML functions.
 */
export class StaticImlProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {
	/**
	 * # DOCUMENTATION FROM VSCODE:
	 *
	 * Given a completion item fill in more data, like {@link CompletionItem.documentation doc-comment}
	 * or {@link CompletionItem.detail details}.
	 *
	 * The editor will only resolve a completion item once.
	 *
	 * *Note* that this function is called when completion items are already showing in the UI or when an item has been
	 * selected for insertion. Because of that, no property that changes the presentation (label, sorting, filtering etc)
	 * or the (primary) insert behaviour ({@link CompletionItem.insertText insertText}) can be changed.
	 *
	 * This function may fill in {@link CompletionItem.additionalTextEdits additionalTextEdits}. However, that means an item might be
	 * inserted *before* resolving is done and in that case the editor will do a best effort to still apply those additional
	 * text edits.
	 *
	 * @param item A completion item currently active in the UI.
	 * @param _token A cancellation token.
	 * @returns The resolved completion item or a thenable that resolves to of such. It is OK to return the given
	 * `item`. When no result is returned, the given `item` will be used.
	 */
	resolveCompletionItem(
		item: vscode.CompletionItem,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.CompletionItem> {
		return item;
	}

	/**
	 * # DOCUMENTATION FROM VSCODE:
	 *
	 * Provide completion items for the given position and document.
	 *
	 * @param _document The document in which the command was invoked.
	 * @param _position The position at which the command was invoked.
	 * @param _token A cancellation token.
	 * @param _context How the completion was triggered.
	 *
	 * @returns An array of completions, a {@link CompletionList completion list}, or a thenable that resolves to either.
	 * The lack of a result can be signaled by returning `undefined`, `null`, or an empty array.
	 */
	provideCompletionItems(
		_document: vscode.TextDocument,
		_position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
		if (!availableImlFunctionsDocCache) {
			availableImlFunctionsDocCache = getAvailableImlFunctionsDoc(imlDocumentation);
		}
		return availableImlFunctionsDocCache;
	}
}

/**
 * Processes the IML Documentation object from `@integromat/iml` lib
 * and returns it in format suitable for this extension.
 */
function getAvailableImlFunctionsDoc(dictionary: ImlDocumentation): vscode.CompletionItem[] {
	const keys = Object.keys(IML.FUNCTIONS).filter((key) => {
		return key !== '';
	});
	const availableFunctions = keys.map((name) => {
		const f = IML.FUNCTIONS[name];
		const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
		if (Array.isArray(f.group)) {
			item.documentation = new vscode.MarkdownString(
				f.group
					.map((group: keyof ImlDocumentation) => {
						const functionNameDoc = (dictionary[group] as any as ImlDocumentation['general'] | undefined)
							?.functions?.[name];
						if (functionNameDoc !== undefined) {
							return functionNameDoc.help;
						}
					})
					.join('\n\n------------\n\n'),
			);
		} else {
			const functionNameDoc = (
				dictionary[f.group as keyof ImlDocumentation] as any as ImlDocumentation['general'] | undefined
			)?.functions?.[name];
			if (functionNameDoc !== undefined) {
				item.documentation = new vscode.MarkdownString(functionNameDoc.help || '');
			}
		}
		item.insertText = `${name}()`;
		item.detail = `${f.value.toString().replace(/{(.|\n)+}/gm, '{ ... }')}: ${f.type}`;
		return item;
	});
	return availableFunctions;
}
