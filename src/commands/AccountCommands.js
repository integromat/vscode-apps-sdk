/* eslint-disable semi,@typescript-eslint/no-var-requires */
const vscode = require('vscode')
const axios = require('axios');

const Core = require('../Core')
const Enum = require('../Enum')
const Meta = require('../Meta');
const { showError } = require('../error-handling');

class AccountCommands {
	static async register(_configuration) {

		/**
         * Login command
         */
		vscode.commands.registerCommand('apps-sdk.login', async () => {

			// Load environment from configuration
			let environment = _configuration.environments.find(e => e.uuid === _configuration.environment)

			// Prompt for API key
			let apikey = await vscode.window.showInputBox({ prompt: `Enter your API key for environment ${environment.name}.` })

			// Check if filled
			if (!Core.isFilled("apikey", "your account", apikey, "An", false)) { return }

			// who-am-I endpoint test
			if (environment.version === 2) {
				let uri = `http${environment.unsafe === true ? '' : 's'}://${environment.url}${environment.noVersionPath === true ? '' : `/v${environment.version}`}/users/me`
				try {
					await axios({
						url: uri,
						headers: {
							Authorization: `Token ${apikey}`,
							'x-imt-apps-sdk-version': Meta.version
						}
					})
				} catch (err) {
					showError(err, 'apps-sdk.login');
					return;
				}
			} else {
				let uri = `https://${environment.url}/v1/whoami`
				let response = await Core.rpGet(uri, `Token ${apikey}`)
				if (response === undefined) { return }
			}

			// Update environments, save everything and reload the window
			let environments = JSON.parse(JSON.stringify(_configuration.environments))
			environments.find(e => e.uuid === _configuration.environment).apikey = apikey;
			Promise.all([
				_configuration.update('login', true, 1),
				_configuration.update('environments', environments, 1),
			]).then(() => {
				vscode.commands.executeCommand("workbench.action.reloadWindow")
			})
		})

		/**
		 * Logout command
		 */
		vscode.commands.registerCommand('apps-sdk.logout', async () => {

			// Confirmation prompt
			let answer = await vscode.window.showQuickPick(Enum.logout, {
				placeHolder: "Do you really want to log out?"
			})

			// Check if filled
			if (!Core.isFilled("answer", "logout", answer, "An", false)) { return }

			// If answer is yes -> update environments, login to falsey, save and reload
			if (answer.label === "Yes") {
				let environments = JSON.parse(JSON.stringify(_configuration.environments))
				environments.find(e => e.uuid === _configuration.environment).apikey = ""
				Promise.all([
					_configuration.update('login', false, 1),
					_configuration.update('environments', environments, 1)
				]).then(() => {
					vscode.commands.executeCommand("workbench.action.reloadWindow")
				})
			}
		})
	}
}

module.exports = AccountCommands
