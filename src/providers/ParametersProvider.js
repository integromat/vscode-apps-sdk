const vscode = require('vscode')

const Core = require('../Core')
const Meta = require('../Meta')

const rp = require('request-promise')
const jsoncParser = require('jsonc-parser');

class ParametersProvider {
	constructor(_authorization, _environment) {
		this._authorization = _authorization
		this._environment = _environment
		this.availableParameters = ["parameters"]
		this.parameters = []
	}

	async loadParameters(crumbs, version) {

		// Preparing api route
		let urn = `/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${crumbs[2]}`
		if (Core.isVersionable(crumbs[3])) {
			urn += `/${version}`
		}
		urn += `/${crumbs[3]}/${crumbs[4]}`

        /*
         * PARAMETERS
         */
		if (["connection", "webhook", "rpc", "module", "connections", "webhooks", "rpcs", "modules"].includes(crumbs[3])) {
			let url = `${this._environment.baseUrl}${urn}/parameters`
			let parameters = await rp({
				url: url,
				headers: {
					'Authorization': this._authorization,
					'x-imt-apps-sdk-version': Meta.version
				}
			}).catch(err => {
				vscode.window.showErrorMessage(err.error.message || err)
			})
			this.availableParameters = this.availableParameters.concat(this.generateParametersMap(jsoncParser.parse(parameters), "parameters"))
		}

        /*
         * EXPECT
         */
		if (crumbs[3] === "module" || crumbs[3] === "modules") {
			let url = `${this._environment.baseUrl}${urn}/expect`
			let expect = await rp({
				url: url,
				headers: {
					'Authorization': this._authorization,
					'x-imt-apps-sdk-version': Meta.version
				}
			}).catch(err => {
				vscode.window.showErrorMessage(err.error.message || err)
			})
			this.availableParameters = this.availableParameters.concat(this.generateParametersMap(jsoncParser.parse(expect), "parameters"))
		}

		this.parameters = this.availableParameters.map(parameter => { return new vscode.CompletionItem(parameter, vscode.CompletionItemKind.Variable) })
	}

	generateParametersMap(parameters, root) {
		let out = []
		parameters.forEach(parameter => {
			if (parameter.name !== undefined) {
				out.push(`${root}.${parameter.name}`)
			}
			if (Array.isArray(parameter.nested)) {
				out = out.concat(this.generateParametersMap(parameter.nested, root))
			}
			if (parameter.type === "collection" && Array.isArray(parameter.spec)) {
				out = out.concat(this.generateParametersMap(parameter.spec, `${root}.${parameter.name}`))
			}
			else if (parameter.type === "select" && Array.isArray(parameter.options)) {
				parameter.options.forEach(option => {
					if (Array.isArray(option.nested)) {
						out = out.concat(this.generateParametersMap(option.nested, root))
					}
				})
			}
		})
		return out
	}

	resolveCompletionItem(item) {
		return item
	}

	provideCompletionItems(document, position) {
		let needle = document.getText(document.getWordRangeAtPosition(position, new RegExp("([A-Z0-9.a-z])+")))
		if (needle.indexOf('.') > -1) {
			let candidates = this.parameters.filter(parameter => {
				let match = parameter.label.match(`${needle}.[A-Za-z0-9]+`)
				if (match !== null && match[0].length === match.input.length) {
					return true
				}
			})
			return candidates.map(parameter => {
				let toInsert = parameter.label.split('.')[parameter.label.split('.').length - 1]
				let toProvide = new vscode.CompletionItem(toInsert, vscode.CompletionItemKind.Property)
				toProvide.insertText = toInsert;
				toProvide.label = toInsert;
				return toProvide
			})
		}
		else {
			return this.parameters.filter(parameter => {
				if (parameter.label.indexOf('.') === -1 && parameter.label.match(needle) !== null) {
					return true
				}
			})
		}
	}
}

module.exports = ParametersProvider