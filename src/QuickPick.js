const vscode = require('vscode');
const Core = require('./Core');

module.exports = {
	connections: async function (environment, authorization, app, allow_no) {
		let response = await Core.rpGet(`${environment}/app/${app.name}/connection`, authorization)
		try {
			let connections = response.map(connection => {
				return {
					label: connection.label,
					description: connection.name
				}
			})
			if (allow_no) {
				connections.push({ label: "--- Without connection ---", description: "Will create entity without connection." })
			}
			return connections
		}
		catch (err) {
			vscode.window.showErrorMessage(err.error.message)
		}
	},

	webhooks: async function (environment, authorization, app, allow_no) {
		let response = await Core.rpGet(`${environment}/app/${app.name}/webhook`, authorization)
		try {
			let webhooks = response.map(webhook => {
				return {
					label: webhook.label,
					description: webhook.name
				}
			})
			if (allow_no) {
				webhooks.push({ label: "--- Without webhook ---", description: "Will create entity without webhook." })
			}
			return webhooks
		}
		catch (err) {
			vscode.window.showErrorMessage(err.error.message)
		}
	},

	countries: async function (environment, authorization) {
		let countries = await Core.rpGet(`${environment}/country`, authorization)
		try {
			return countries.map(country => {
				return {
					label: country.name,
					description: country.code
				}
			})
		}
		catch (err) {
			vscode.window.showErrorMessage(err.error.message)
		}
	},

	languages: async function (environment, authorization, context) {
		let response = await Core.rpGet(`${environment}/language`, authorization)
		let languages = response.map(language => {
			if (language == null) { return }
			return {
				label: language.name,
				description: language.code
			}
		})
		if (context) {
			let current = await Core.rpGet(`${environment}/app/${context.name}/${context.version}`, authorization)
			languages.unshift({
				label: "Keep current",
				description: current.language
			})
		}
		return languages;
	},

	environments: function (configuration) {
		let envs = Object.keys(configuration.environments).map(key => { return { label: configuration.environments[key].name, description: key } })
		envs.push({ label: "+ Add a new environment", description: "add" })
		return envs
	},

	allApps: async function (environment, authorization) {
		let response = await Core.rpGet(`${environment}/app`, authorization, { all: true })
		try {
			return response.map(app => {
				return {
					label: app.label,
					description: app.name
				}
			})
		}
		catch (err) {
			vscode.window.showErrorMessage(err.message || err.error.message)
		}
	},

	favApps: async function (environment, authorization) {
		let response = await Core.rpGet(`${environment}/app`, authorization)
		try {
			return response.map(app => {
				return {
					label: app.label,
					description: app.name
				}
			})
		}
		catch (err) {
			vscode.window.showErrorMessage(err.message || err.error.message)
		}
	}
}