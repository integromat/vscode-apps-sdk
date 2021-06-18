const vscode = require('vscode')
const jsoncParser = require('jsonc-parser');
const union = require('lodash.union')

class TempProvider {
	constructor(name) {
		this.availableVariables = ["temp"]
		this.variables = []
		this.name = name
	}

	resolveCompletionItem(item) {
		return item
	}

	provideCompletionItems(document, position) {
		// Get all available variables
		this.getAvailableVariables(document)
		// Make them applicable
		this.variables = this.availableVariables.map(variable => { return new vscode.CompletionItem(variable, vscode.CompletionItemKind.Variable) })
		/**
		 * PROVIDE
		 */
		let needle = document.getText(document.getWordRangeAtPosition(position, new RegExp("([A-Z0-9.a-z])+")))
		if (needle.indexOf('.') > -1) {
			let candidates = this.variables.filter(variable => {
				let match = variable.label.match(`${needle}.[A-Za-z0-9]+`)
				if (match !== null && match[0].length === match.input.length) {
					return true
				}
			})
			return candidates.map(variable => {
				let toInsert = variable.label.split('.')[variable.label.split('.').length - 1]
				let toProvide = new vscode.CompletionItem(toInsert, vscode.CompletionItemKind.Property)
				toProvide.insertText = toInsert;
				toProvide.label = toInsert;
				return toProvide
			})
		}
		else {
			return this.variables.filter(variable => {
				if (variable.label.indexOf('.') === -1 && variable.label.match(needle) !== null) {
					return true
				}
			})
		}
	}

	getAvailableVariables(document) {
		const text = document.getText();
		const request = jsoncParser.parse(text);
		// Switch the providing context based on the document name
		switch (this.name) {
			// Regular request format
			case 'api':
			case 'attach':
			case 'publish':
			case 'detach':
			case 'epoch':
			case 'base':
				// text.temp and text.response.temp
				// If multiple requests
				if (Array.isArray(request)) {
					let variables = ["temp"]
					request.forEach(r => {
						variables = union(variables, this.parseTempRegular(r))
					})
					this.availableVariables = variables
				}
				// Only one request
				else {
					this.availableVariables = ["temp"].concat(this.parseTempRegular(request))
				}
				break;
			// OAuth request format
			case 'api-oauth':
				let variables = ["temp"]
				// Scan for temp in all available keys
				Object.keys(request).forEach(k => {
					variables = union(variables, this.parseTempRegular(request[k]))
				})
				this.availableVariables = variables;
				break;
		}
	}

	parseTempRegular(request) {
		const fromRoot = request.temp ? this.generateTempMap(request.temp, "temp") : [];
		const fromResponse = request.response ? (request.response.temp ? this.generateTempMap(request.response.temp, "temp") : []) : [];
		return union(fromResponse, fromRoot)
	}

	generateTempMap(temp, root) {
		let out = []
		Object.keys(temp).forEach(t => {
			out.push(`${root}.${t}`);
			if (typeof temp[t] === 'object' && temp[t] !== null) {
				out = out.concat(this.generateTempMap(temp[t], `${root}.${t}`))
			}
		})
		return out
	}
}

module.exports = TempProvider