const vscode = require('vscode')

const Core = require('../Core')
const Enum = require('../Enum')

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
			let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${Core.pathDeterminer(_environment.version, 'connection')}`

			// Send the request
			try {
				await Core.addEntity(_authorization, {
					"label": label,
					"type": type.description
				}, uri)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Edit connection
         */
		vscode.commands.registerCommand('apps-sdk.connection.edit-metadata', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Label prompt with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize connection label",
				value: context.bareLabel
			})
			if (!Core.isFilled("label", "connection", label)) { return }


			if (_environment.version === 2) {
				let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.pathDeterminer(_environment.version, 'connection')}/${context.name}`
				try {
					await Core.patchEntity(_authorization, {
						label: label
					}, uri)
					appsProvider.refresh()
				}
				catch (err) {
					vscode.window.showErrorMessage(err.error.message || err)
				}
			} else {
				let uri = `${_environment.baseUrl}/app/${context.parent.parent.name}/connection/${context.name}/label`
				try {
					await Core.editEntityPlain(_authorization, label, uri)
					appsProvider.refresh()
				}
				catch (err) {
					vscode.window.showErrorMessage(err.error.message || err)
				}
			}
		})
	}
}

module.exports = ConnectionCommands