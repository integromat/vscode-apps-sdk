const vscode = require('vscode')

const Core = require('../Core')
const Enum = require('../Enum')
const Meta = require('../Meta')

const tempy = require('tempy');
const asyncfile = require('async-file')
const rp = require('request-promise');

class ChangesCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * Show changes
         */
		vscode.commands.registerCommand('apps-sdk.changes.show', async function (code) {

			// Get the diff
			let url = `${_environment}/app/${Core.getApp(code).name}/${Core.getApp(code).version}/change/${code.change}`
			let diffdata = await Core.rpGet(url, _authorization)

			// Prepare paths for files
			let old = tempy.file({ name: `old.${code.language}` })
			let cur = tempy.file({ name: `cur.${code.language}` })

			// Get the data to write
			let old_data = (code.language === "js" || code.language === "md") ? diffdata.old_value : JSON.stringify(diffdata.old_value, null, 4)
			let cur_data = (code.language === "js" || code.language === "md") ? diffdata.new_value : JSON.stringify(diffdata.new_value, null, 4)

			// Save the files
			Promise.all([
				await asyncfile.writeFile(old, old_data),
				await asyncfile.writeFile(cur, cur_data)
			]).then(() => {

				// Display diff between the files
				vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(old), vscode.Uri.file(cur), `Changes of ${code.name} in ${code.parent.name}`).catch(err => {
					vscode.window.showErrorMessage(err)
				})
			})
		})

        /**
         * Commit changes
         */
		vscode.commands.registerCommand('apps-sdk.changes.commit', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.commit, { placeHolder: "Do you really want to commit all changes in the app?" })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage("No changes were commited.")
					break
				case "Yes":
					// Compose URI
					let uri = `${_environment}/app/${context.name}/${context.version}/commit`
					try {
						await rp({
							method: 'POST',
							uri: uri,
							headers: {
								Authorization: _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							json: true
						})
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}
		})

        /**
         * Rollback changes
         */
		vscode.commands.registerCommand('apps-sdk.changes.rollback', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.rollback, { placeHolder: "Do you really want to rollback all changes in the app?" })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage("No changes were rolled back.")
					break
				case "Yes":
					// Compose URI
					let uri = `${_environment}/app/${context.name}/${context.version}/rollback`
					try {
						await rp({
							method: 'POST',
							uri: uri,
							headers: {
								Authorization: _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							json: true
						})
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

module.exports = ChangesCommands