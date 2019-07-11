const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')
const QuickPick = require('../QuickPick')

const camelCase = require('lodash.camelcase');
const path = require('path')

class RpcCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * New RPC
         */
		vscode.commands.registerCommand('apps-sdk.rpc.new', async function (context) {

			// Context workaround
			if (!Core.contextGuard(context)) { return }
			let app = context.parent

			// Label prompt
			let label = await vscode.window.showInputBox({ prompt: "Enter RPC label" })
			if (!Core.isFilled("label", "RPC", label)) { return }

			// Id (name) prompt
			let id = await vscode.window.showInputBox({
				prompt: "Enter RPC Id",
				value: camelCase(label),
				validateInput: Validator.rpcName
			})
			if (!Core.isFilled("id", "RPC", id, "An")) { return }

			// Connection prompt
			let connection = await vscode.window.showQuickPick(QuickPick.connections(_environment, _authorization, app, true))
			if (!Core.isFilled("connection", "RPC", connection)) { return }

			// Connection and URI compose
			connection = connection.label === "--- Without connection ---" ? undefined : connection.description
			let uri = `${_environment}/app/${app.name}/${app.version}/rpc`

			// Request
			try {
				await Core.addEntity(_authorization, {
					"name": id,
					"label": label,
					"connection": connection
				}, uri)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Edit RPC
         */
		vscode.commands.registerCommand('apps-sdk.rpc.edit-metadata', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Prompt for label with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize RPC label",
				value: context.label
			})
			if (!Core.isFilled("label", "RPC", label)) { return }

			// Send the request
			try {
				await Core.editEntityPlain(_authorization, label, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/label`)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Change RPC connection
         */
		vscode.commands.registerCommand('apps-sdk.rpc.change-connection', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Prompt for connection
			let connections = await QuickPick.connections(_environment, _authorization, context.parent.parent, true)

			if (connections.length > 2) {
				const rpcDetail = await Core.rpGet(`${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}`, _authorization);
				
				const primaryConnectionOptions = connections;
				let hasPrimary = !!rpcDetail.connection;
				if(hasPrimary) {
					const toSelectIndex = primaryConnectionOptions.findIndex(o => o.description === rpcDetail.connection);
					const toSelect = primaryConnectionOptions[toSelectIndex];
					toSelect.label += ` (current)`;
					toSelect.description = 'keep';
					primaryConnectionOptions.splice(toSelectIndex,1);
					primaryConnectionOptions.unshift(toSelect);
				} else {
					const toSelectIndex = primaryConnectionOptions.findIndex(o => o.label === '--- Without connection ---');
					const toSelect = primaryConnectionOptions[toSelectIndex];
					toSelect.label += ` (current)`;
					toSelect.description = 'keep';
					primaryConnectionOptions.splice(toSelectIndex,1);
					primaryConnectionOptions.unshift(toSelect);
				}

				let connection = await vscode.window.showQuickPick(primaryConnectionOptions, { placeHolder: "Change primary connection or keep existing." });
				if (!Core.isFilled("connection", "RPC", connection)) { return }

				if (rpcDetail.connection === null && (connection.description === 'keep' || connection.label === '--- Without connection ---')) { return; }
				if (connection.description !== "keep") {
					if (connection.label === '--- Without connection ---') {
						hasPrimary = false;
					} else {
						hasPrimary = true;
					}
					connection = connection.label === "--- Without connection ---" ? "" : connection.description
					try {
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/connection`)
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
				}
				if (!hasPrimary) {
					appsProvider.refresh();
					return;
				}

				const secondaryConnectionOptions = await QuickPick.connections(_environment, _authorization, context.parent.parent, true);
				if(!!rpcDetail.alt_connection) {
					const toSelectIndex = secondaryConnectionOptions.findIndex(o => o.description === rpcDetail.alt_connection);
					const toSelect = secondaryConnectionOptions[toSelectIndex];
					toSelect.label += ` (current)`;
					toSelect.description = 'keep';
					secondaryConnectionOptions.splice(toSelectIndex,1);
					secondaryConnectionOptions.unshift(toSelect);
				} else {
					const toSelectIndex = secondaryConnectionOptions.findIndex(o => o.label === '--- Without connection ---');
					const toSelect = secondaryConnectionOptions[toSelectIndex];
					toSelect.label += ` (current)`;
					toSelect.description = 'keep';
					secondaryConnectionOptions.splice(toSelectIndex,1);
					secondaryConnectionOptions.unshift(toSelect);
				}

				connection = await vscode.window.showQuickPick(secondaryConnectionOptions, { placeHolder: "Change secondary connection or keep existing." })
				if (!Core.isFilled("connection", "RPC", connection)) { return }
				if (connection.description !== "keep") {
					connection = connection.label === "--- Don\'t use secondary connection ---" ? "" : connection.description
					try {
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/alt_connection`)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
				}
			} else {
				connections = [{ label: "Don't change", description: "keep" }].concat(connections)
				let connection = await vscode.window.showQuickPick(connections, { placeHolder: "Change connection or keep existing." })
				if (!Core.isFilled("connection", "RPC", connection)) { return }

				// Send the request
				try {
					if (connection.description !== "keep") {
						connection = connection.label === "--- Without connection ---" ? "" : connection.description
						await Core.editEntityPlain(_authorization, connection, `${_environment}/app/${context.parent.parent.name}/${context.parent.parent.version}/rpc/${context.name}/connection`)
						appsProvider.refresh()
					}
				}
				catch (err) {
					vscode.window.showErrorMessage(err.error.message || err)
				}
			}
		})

        /**
         * Test RPC
         */
		vscode.commands.registerCommand('apps-sdk.rpc.test', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Create a new WebviewPanel object
			const panel = vscode.window.createWebviewPanel(
				`${context.name}_test`,
				`${context.label} test`,
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			)

			// Inject the RPC name and set the HTML code
			panel.webview.html = Core.getRpcTestHtml(context.name, context.parent.parent.name, context.parent.parent.version, path.join(__dirname, '..', '..'))

		})
	}
}

module.exports = RpcCommands