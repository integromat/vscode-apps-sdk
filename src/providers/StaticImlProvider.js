const vscode = require('vscode');
const { IML, imlDocumentation } = require('@integromat/iml');

class StaticImlProvider {
	constructor() {
		this.availableFunctions = [];
	}

	async initialize() {
		this.availableFunctions = getAvailableImlFunctionsDoc(imlDocumentation);
	}

	resolveCompletionItem(item) {
		return item;
	}

	provideCompletionItems() {
		return this.availableFunctions;
	}
}

/**
 * Processes the IML Documentation object from `@integromat/iml` lib
 * and returns it in format suitable for this extension.
 * @param {import('@integromat/iml').ImlDocumentation} dictionary
 */
function getAvailableImlFunctionsDoc(dictionary) {
	let keys = Object.keys(IML.FUNCTIONS);
	keys = keys.filter(key => {
		return key === "" ? false : true;
	});
	let availableFunctions = keys.map(name => {
		let f = IML.FUNCTIONS[name];
		let item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
		if (Array.isArray(f.group)) {
			item.documentation = new vscode.MarkdownString(
				f.group.map(group => {
					if (dictionary[group].functions[name] !== undefined) {
						return dictionary[group].functions[name].help;
					}
				}).join("\n\n------------\n\n")
			);
		}
		else {
			if (dictionary[f.group].functions[name] !== undefined) {
				item.documentation = new vscode.MarkdownString(dictionary[f.group].functions[name].help || "");
			}
		}
		item.insertText = `${name}()`;
		item.detail = `${f.value.toString().replace(/{(.|\n)+}/gm, '{ ... }')}: ${f.type}`;
		return item;
	});
	return availableFunctions;
}

module.exports.StaticImlProvider = StaticImlProvider;
