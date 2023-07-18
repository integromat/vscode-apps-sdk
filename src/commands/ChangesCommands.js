/* eslint-disable semi,@typescript-eslint/no-var-requires */
const vscode = require('vscode')
const axios = require('axios');

const Core = require('../Core')
const Enum = require('../Enum')
const Meta = require('../Meta')
const Validator = require('../Validator')

const tempy = require('tempy');
const asyncfile = require('async-file')
const { showError } = require('../error-handling');

class ChangesCommands {
	static async register(appsProvider, _authorization, _environment) {

        /**
         * Show changes
         */
		vscode.commands.registerCommand('apps-sdk.changes.show', async function (code) {

			// Get the diff
			const url = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.getApp(code).name}/${Core.getApp(code).version}/${Core.pathDeterminer(_environment.version, 'change')}/${code.change}`
			let diffdata = await Core.rpGet(url, _authorization)

			// Prepare paths for files
			let old = tempy.file({ name: `old.${code.language}` })
			let cur = tempy.file({ name: `cur.${code.language}` })

			// Get the data to write
			let old_data = (code.language === "js" || code.language === "md") ? (diffdata.old_value || diffdata.oldValue || diffdata.change.oldValue) : (JSON.stringify((diffdata.old_value || diffdata.oldValue), null, 4) || diffdata.change.oldValue)
			let cur_data = (code.language === "js" || code.language === "md") ? (diffdata.new_value || diffdata.newValue || diffdata.change.newValue) : (JSON.stringify((diffdata.old_value || diffdata.oldValue), null, 4) || diffdata.change.newValue)

			// Save the files
			Promise.all([
				await asyncfile.writeFile(old, old_data),
				await asyncfile.writeFile(cur, cur_data)
			]).then(() => {

				// Display diff between the files
				vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(old), vscode.Uri.file(cur), `Changes of ${code.name} in ${code.parent.name}`).catch(err => {
					showError(err);
				})
			})
		})

        /**
         * Commit changes
         */
		vscode.commands.registerCommand('apps-sdk.changes.commit', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			let commitMessage = await vscode.window.showInputBox({ prompt: "Enter commit message", validateInput: Validator.commitMessage })
			if (commitMessage === undefined || commitMessage === null) {
				vscode.window.showWarningMessage("No commit message provided.")
				return
			}

			let notify = await vscode.window.showQuickPick(Enum.notify, { placeHolder: "Notify about the update and add the update to the timeline?" })
			if (notify === undefined || notify === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}
			notify = notify.label === "Yes" ? true : false;

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
					let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}/commit`
					try {
						await axios({
							method: 'POST',
							url: uri,
							headers: {
								Authorization: _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							data: {
								notify: notify,
								message: commitMessage
							},
						})
						appsProvider.refresh()
					}
					catch (err) {
						showError(err, 'apps-sdk.changes.commit');
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
					let uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}/rollback`
					try {
						await axios({
							method: 'POST',
							url: uri,
							headers: {
								Authorization: _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
						})
						appsProvider.refresh()
					}
					catch (err) {
						showError(err, 'apps-sdk.changes.rollback');
					}
					break
			}
		})
	}
}

module.exports = ChangesCommands
