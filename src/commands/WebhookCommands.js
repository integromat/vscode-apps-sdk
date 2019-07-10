const vscode = require('vscode')

const Core = require('../Core')
const QuickPick = require('../QuickPick')
const Enum = require('../Enum')

class WebhookCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * New webhook
         */
		vscode.commands.registerCommand('apps-sdk.webhook.new', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context.parent

			// Label prompt
			let label = await vscode.window.showInputBox({ prompt: "Enter webhook label" })
			if (!Core.isFilled("label", "webhook", label)) { return }

			// Type prompt
			let type = await vscode.window.showQuickPick(Enum.webhookTypes)
			if (!Core.isFilled("type", "webhook", type)) { return }

			// Connections prompt (decide if compulsory or not)
			let connections
			switch (type.description) {
				case "web":
					connections = QuickPick.connections(_environment, _authorization, app, true)
					break
				case "web-shared":
					connections = QuickPick.connections(_environment, _authorization, app, false)
					break
			}
			let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Choose a connection for the new webhook." })
			if (!Core.isFilled("connection", "webhook", connection)) { return }

			// Build URI and prepare connection value
			let uri = `${_environment}/app/${app.name}/webhook`
			connection = connection.label === "--- Without connection ---" ? "" : connection.description

			// Send the request
			try {
				await Core.addEntity(_authorization, {
					"label": label,
					"type": type.description,
					"connection": connection
				}, uri)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Edit webhook
         */
		vscode.commands.registerCommand('apps-sdk.webhook.edit-metadata', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Label prompt with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize webhook label",
				value: context.label
			})
			if (!Core.isFilled("label", "webhook", label)) { return }

			// Send the request
			try {
				await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/label`)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Change webhook connection
         */
		vscode.commands.registerCommand('apps-sdk.webhook.change-connection', async function (context) {

			//Context check
			if (!Core.contextGuard(context)) { return }

			// Prepare connections -> determine if required or not
			let connections
			let multi = false;
			switch (context.type) {
				case "web":
					connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)
					if (connections.length > 1) {
						multi = true;
					}
					break
				case "web-shared":
					connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, false)
					if (connections.length > 2) {
						multi = true;
					}
					break
			}

			if (multi) {
				const webhookDetail = await Core.rpGet(`${_environment}/app/${context.parent.parent.name}/webhook/${context.name}`, _authorization);
				const primaryConnectionOptions = [{ label: "Don't change", description: "keep" }].concat(connections);
				let connection = await vscode.window.showQuickPick(primaryConnectionOptions, { placeHolder: "Change primary connection or keep existing." });
				let hasPrimary = !!webhookDetail.connection;
				if (!Core.isFilled("connection", "webhook", connection)) { return }
				if (webhookDetail.connection === null && (connection.description === 'keep' || connection.label === '--- Without connection ---')) { return; }
				if (connection.description !== "keep") {
					if (connection.label === '--- Without connection ---') {
						hasPrimary = false;
					} else {
						hasPrimary = true;
					}
					connection = connection.label === "--- Without connection ---" ? "" : connection.description
					try {
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/connection`)
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
				}
				if (!hasPrimary) {
					appsProvider.refresh();
					return;
				}
				const secondaryConnectionOptions = [{ label: "Don't change", description: "keep" }].concat(connections);
				secondaryConnectionOptions.find(c => c.label === "--- Without connection ---").label = '--- Don\'t use secondary connection ---';
				if (context.type === 'web-shared') {
					secondaryConnectionOptions.push({ label: '--- Don\'t use secondary connection ---', description: 'dont-use' });
				}
				connection = await vscode.window.showQuickPick(secondaryConnectionOptions, { placeHolder: "Change secondary connection or keep existing." })
				if (!Core.isFilled("connection", "webhook", connection)) { return }
				if (connection.description !== "keep") {
					connection = connection.label === "--- Don\'t use secondary connection ---" ? "" : connection.description
					try {
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/alt_connection`)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
				}
			} else {
				connections = [{ label: "Don't change", description: "keep" }].concat(connections)

				// Prompt for connection
				let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
				if (!Core.isFilled("connection", "webhook", connection)) { return }

				// Send the request
				try {
					if (connection.description !== "keep") {
						connection = connection.label === "--- Without connection ---" ? "" : connection.description
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/webhook/${context.name}/connection`)
						appsProvider.refresh()
					}
				}
				catch (err) {
					vscode.window.showErrorMessage(err.error.message || err)
				}
			}
		})
	}
}

module.exports = WebhookCommands