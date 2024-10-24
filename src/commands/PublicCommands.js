const vscode = require('vscode')
const path = require('path')

const udt = require('@integromat/udt');

const Core = require('../Core')

class PublicCommands {
	static async register() {
		vscode.commands.registerCommand('apps-sdk.help', async function () {
			vscode.commands.executeCommand(
				'vscode.open',
				vscode.Uri.parse('https://developers.make.com/custom-apps-documentation'),
			);
		});

		vscode.commands.registerCommand('apps-sdk.udt', async function () {
			const panel = vscode.window.createWebviewPanel(
				`udt_generator`,
				`Data Structure Generator`,
				vscode.ViewColumn.One,
				{
					retainContextWhenHidden: true,
					enableScripts: true
				}
			)
			panel.webview.html = Core.getUdtGeneratorHtml(path.join(__dirname, '..', '..'))
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.command === "parse") {
					let structure = await new Promise((resolve) => {
						udt.generate(message.type, message.source, (ex, res) => {
							if (ex) {
								resolve({
									command: 'error',
									structure: ex.message
								});
							}
							resolve({
								command: 'display',
								structure: res
							});
						})
					})
					if (structure.command === 'display') {
						structure.structure = udt.generateLabels(structure.structure);
						function innerLabels(parameters) {
							parameters.forEach(parameter => {
								if (parameter.type === 'collection') {
									parameter.spec = udt.generateLabels(parameter.spec);
									innerLabels(parameter.spec);
								} else if (parameter.type === 'array') {
									if (parameter.spec && parameter.spec.type === 'collection') {
										parameter.spec.spec = udt.generateLabels(parameter.spec.spec)
										innerLabels(parameter.spec.spec)
									}
								}
							})
						}
						innerLabels(structure.structure);
					}
					panel.webview.postMessage(structure)
				}
			})


		})
	}
}

module.exports = PublicCommands
