/* eslint-disable semi,@typescript-eslint/no-var-requires */
const vscode = require('vscode')
const axios = require('axios');

const Core = require('../Core')
const QuickPick = require('../QuickPick')
const Validator = require('../Validator')
const Meta = require('../Meta')

const { v4: uuidv4 } = require('uuid');

class EnvironmentCommands {
	static async register(envChanger, _configuration) {

        /**
         * Add new environment
         */
		vscode.commands.registerCommand('apps-sdk.env.add', async () => {

			// Prompt for environments
			let version = await vscode.window.showQuickPick([
				{
					label: 'Integromat',
					description: '1'
				},
				{
					label: 'Make',
					description: '2'
				}], {
				placeHolder: 'Choose an environment.'
			});

			// Prompt for URL
			let url = await vscode.window.showInputBox({
				prompt: version.description === '2' ? "Enter a new Make environment URL (without https:// and API version)" : "Enter a new Integromat environment URL (without https:// and API version)",
				value: version.description === '2' ? "eu1.make.com/api" : "api.integromat.com",
				// validateInput: Validator.urlFormat // As anybody can host Integromat almost anywhere, there's no place for some RegExp validation
			})

			// Check if filled and unique
			if (!Core.isFilled("url", "environment", url, "An")) { return }

			// Removed Unique Index of URL here.

			// Prompt for environment name
			let name = await vscode.window.showInputBox({
				prompt: "Enter new environment name",
				value: url === "api.integromat.com" ? "Integromat: " : "Make: "
			})

			// Check if filled
			if (!Core.isFilled("name", "environment", name)) { return }

			// Check if filled
			if (!Core.isFilled("version", "environment", name)) { return }

			// Prompt for API key
			let	apikey = await vscode.window.showInputBox({ prompt: `Enter your ${version.description === '2' ? 'Make' : "Integromat"} API key` })

			// Check if filled
			if (!Core.isFilled("API key", "your account", apikey, "An", false)) { return }

			if (version.description === '2') {
				let uri = `https://${url}/v2/users/me`
				try {
					await axios({
						url: uri,
						headers: {
							'Authorization': `Token ${apikey}`,
							'x-imt-apps-sdk-version': Meta.version
						}
					})
				} catch (err) {
					vscode.window.showWarningMessage(err.error ? err.error.message : err)
					vscode.window.showInformationMessage('Environment probe failed. You can try to set the environment in VSCode settings.json manually.');
					return;
				}
			} else {
				// Ping who-am-I endpoint
				let uri = `https://${url}/v1/whoami`
				let response = await Core.rpGet(uri, `Token ${apikey}`)
				if (response === undefined) { return }
			}

			// RAW copy of environments, because _configuration is read only
			let envs = JSON.parse(JSON.stringify(_configuration.environments))

			// Add new env to environments object
			const newEnvUuid = uuidv4();
			envs.push({
				uuid: newEnvUuid,
				url: url,
				name: name,
				apikey: apikey,
				version: parseInt(version.description)
			})

			// Save all and reload the window
			await Promise.all([
				_configuration.update('login', true, 1),
				_configuration.update('environments', envs, 1),
				_configuration.update('environment', newEnvUuid, 1)
			]);
			vscode.commands.executeCommand("workbench.action.reloadWindow")
		})

		/**
		 * Change environment
		 */
		vscode.commands.registerCommand('apps-sdk.env.change', async () => {

			// Prompt for environment (show quickpick of existing)
			let environment = await vscode.window.showQuickPick(QuickPick.environments(_configuration), {
				placeHolder: "Choose an environment to use"
			})

			// Check if filled
			if (!environment) { return }

			if (environment.description === "add") {
				vscode.commands.executeCommand('apps-sdk.env.add')
				return
			}

			// Update active environment in _configuration
			await _configuration.update('environment', environment.description, 1)

			// If new env doesn't contain API key -> set login falsey
			if (_configuration.environments.find(e => e.uuid === environment.description).apikey === "") {
				await _configuration.update('login', false, 1)
			}

			// Update envChanger in statusbar and reload the window
			envChanger.text = `$(server) ${environment.label}`
			vscode.commands.executeCommand("workbench.action.reloadWindow")
		})
	}
}

module.exports = EnvironmentCommands
