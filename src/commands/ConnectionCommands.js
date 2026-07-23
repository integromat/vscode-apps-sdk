/* eslint-disable semi */
const vscode = require('vscode')

const Core = require('../Core')
const Enum = require('../Enum')
const { showError, catchError } = require('../error-handling')

class ConnectionCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * New connection
         */
		vscode.commands.registerCommand('apps-sdk.connection.new', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context.parent

			// Label prompt
			let label = await vscode.window.showInputBox({ prompt: "Enter connection label" })
			if (!Core.isFilled("label", "connection", label)) { return }

			// Type prompt
			let type = await vscode.window.showQuickPick(Enum.connectionTypes)
			if (!Core.isFilled("type", "connection", type)) { return }

			// Prepare URI
			const uri = `${_environment.baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer('app')}/${app.name}/${Core.pathDeterminer('connection')}`

			// Send the request
			try {
				await Core.addEntity(_authorization, {
					"label": label,
					"type": type.description
				}, uri)
				appsProvider.refresh()
			}
			catch (err) {
				showError(err);
			}
		})

        /**
         * Edit connection
         */
		vscode.commands.registerCommand('apps-sdk.connection.edit-metadata', catchError('Edit metadata', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Label prompt with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize connection label",
				value: context.bareLabel
			})
			if (!Core.isFilled("label", "connection", label)) { return }


			const uri = `${_environment.baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer('app')}/${Core.pathDeterminer('connection')}/${context.name}`
			await Core.patchEntity(_authorization, {
				label: label
			}, uri);
			appsProvider.refresh();
		}));
	}
}

module.exports = ConnectionCommands
