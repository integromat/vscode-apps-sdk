const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')
const Enum = require('../Enum')
const QuickPick = require('../QuickPick')

const camelCase = require('lodash.camelcase');

class ModuleCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * New module
         */
		vscode.commands.registerCommand('apps-sdk.module.new', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context.parent

			// Label prompt
			let label = await vscode.window.showInputBox({ prompt: "Enter module label" })
			if (!Core.isFilled("label", "module", label)) { return }

			// Id prompt
			let id = await vscode.window.showInputBox({
				prompt: "Enter module Id",
				value: camelCase(label),
				validateInput: Validator.moduleName
			})
			if (!Core.isFilled("id", "module", id, "An")) { return }

			// Description prompt
			let description = await vscode.window.showInputBox({ prompt: "Enter module description" })
			if (!Core.isFilled("description", "module", description)) { return }

			// Type prompt
			let type = await vscode.window.showQuickPick(Enum.moduleTypes)
			if (!Core.isFilled("type", "module", type)) { return }

			// Prepare URI and request body
			let uri = `${_environment}/app/${app.name}/${app.version}/module`
			let body = {
				"name": id,
				"label": label,
				"description": description,
				"type_id": type.description
			}

			// Action type selector
			if (type.description === "4") {
				let crud = await vscode.window.showQuickPick(Enum.crud, { placeHolder: "Pick the action type" })
				if (!Core.isFilled("crud", "action", crud)) { return }
				if (crud.label !== "Multipurpose") {
					body.crud = crud.label.toLowerCase();
				}
			}

			// Connection / Webhook / No prompt
			switch (type.description) {
				case "1":
				case "4":
				case "9":
					let connection = await vscode.window.showQuickPick(QuickPick.connections(_environment, _authorization, app, true), { placeHolder: "Pick a connection for the module" })
					if (!Core.isFilled("connection", "module", connection)) { return }
					body.connection = connection.label === "--- Without connection ---" ? "" : connection.description
					break
				case "10":
					let webhook = await vscode.window.showQuickPick(QuickPick.webhooks(_environment, _authorization, app, false), { placeHolder: "Pick a webhook for the module" })
					if (!Core.isFilled("webhook", "module", webhook)) { return }
					body.webhook = webhook.label === "--- Without webhook ---" ? "" : webhook.description
					break
			}

			// Send the request
			try {
				await Core.addEntity(_authorization, body, uri)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Edit module
         */
		vscode.commands.registerCommand('apps-sdk.module.edit-metadata', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			const body = {};

			// Label prompt with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize module label",
				value: context.bareLabel
			})
			if (!Core.isFilled("label", "module", label)) { return }
			body.label = label;

			// Description prompt with prefilled value
			let module = await Core.rpGet(`${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}`, _authorization)
			let description = await vscode.window.showInputBox({
				prompt: "Customize module description",
				value: module.description
			})
			if (!Core.isFilled("description", "module", description)) { return }
			body.description = description

			// Action type selector+
			// Uncomment this when the API's fixed
			/*if (context.type === 4) {
				let crud = await vscode.window.showQuickPick([{ label: "Don't change", description: "keep" }].concat(Enum.crud), { placeHolder: "Change the action type or keep existing." })
				if (!Core.isFilled("crud", "action", crud)) { return }
				if (crud.description !== "keep") {
					body.crud = crud.label === "Multipurpose" ? undefined : crud.label.toLowerCase();
				}
			}*/

			// Remove this after API's fixed
			body.type_id = module.type_id

			// Send the request
			try {
				await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/label`)
				await Core.editEntity(_authorization, body, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}`)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Change module connection or webhook
         */
		vscode.commands.registerCommand('apps-sdk.module.change-connection-or-webhook', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Prompt for connection / webhook / nothing -> based on module type and change it
			switch (context.type) {
				case 1:
				case 4:
				case 9:
					let connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
					connections = [{ label: "Don't change", description: "keep" }].concat(connections)
					let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
					if (!Core.isFilled("connection", "module", connection)) { return }
					if (connection.description !== "keep") {
						connection = connection.label === "--- Without connection ---" ? "" : connection.description
						try {
							await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/connection`)
							appsProvider.refresh()
						}
						catch (err) {
							vscode.window.showErrorMessage(err.error.message || err)
						}
					}
					break
				case 10:
					let webhooks = await QuickPick.webhooks(_environment, _authorization, context.parent.parent, false)
					webhooks = [{ label: "Don't change", description: "keep" }].concat(webhooks)
					let webhook = await vscode.window.showQuickPick(webhooks, { placeHolder: "Change webhook or keep existing." })
					if (!Core.isFilled("webhook", "module", webhook)) { return }
					if (webhook.description !== "keep") {
						try {
							await Core.editEntityPlain(_authorization, webhook.description, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/webhook`)
							appsProvider.refresh()
						}
						catch (err) {
							vscode.window.showErrorMessage(err.error.message || err)
						}
					}
					break
			}
		})

        /**
         * Mark module as private
         */
		vscode.commands.registerCommand('apps-sdk.module.visibility.private', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.hide, { placeHolder: `Do you really want to mark this module as private?` })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If was confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage(`The module has been kept as public.`)
					break
				case "Yes":
					// Set URI and send the request
					let uri = `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/private`
					try {
						await Core.executePlain(_authorization, "", uri)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}

		})

        /**
         * Mark module as public
         */
		vscode.commands.registerCommand('apps-sdk.module.visibility.public', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.publish, { placeHolder: `Do you really want to mark this module as public?` })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If was confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage(`The module has been kept as private.`)
					break
				case "Yes":
					// Set URI and send the request
					let uri = `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/module/${context.name}/public`
					try {
						await Core.executePlain(_authorization, "", uri)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}
		})
	}
}

module.exports = ModuleCommands