/* eslint semi:"off" */
const vscode = require('vscode')
const union = require('lodash/union');

class DataProvider {
	constructor(source, type) {
		this.availableVariables = ["connection"]
		this.variables = []
		this.source = source
		this.type = type
	}

	resolveCompletionItem(item) {
		return item
	}

	provideCompletionItems(document, position) {
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

	getAvailableVariables() {
		// Switch the providing context based on the document name
		switch (this.type) {
			// Regular request format
			case 'basic':
				// text.temp and text.response.data
				// If multiple requests
				if (Array.isArray(this.source)) {
					let variables = ["connection"]
					this.source.forEach(r => {
						variables = union(variables, this.parseData(r))
					})
					this.availableVariables = variables
				}
				// Only one request
				else {
					this.availableVariables = ["connection"].concat(this.parseData(this.source))
				}
				break;
			// OAuth request format
			case 'oauth': {
				let variables = ["connection"]
				// Scan for temp in all available keys
				Object.keys(this.source).forEach(k => {
					variables = union(variables, this.parseData(this.source[k]))
				})
				this.availableVariables = variables;
				break;
			}
		}
	}

	parseData(request) {
		const fromResponse = request.response ? (request.response.data ? this.generateMap(request.response.data, "connection") : []) : [];
		return fromResponse
	}

	generateMap(temp, root) {
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

module.exports.DataProvider = DataProvider;
