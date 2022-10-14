const vscode = require('vscode');
const Core = require('./Core');
const camelCase = require('lodash.camelcase');

module.exports = {
	connections: async function (environment, authorization, app, allow_no) {
		const uri = `${environment.baseUrl}/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}/${app.name}/${Core.pathDeterminer(environment.version, 'connection')}`;
		let response = await Core.rpGet(uri, authorization);
		response = environment.version === 1 ? response : response[camelCase(`appConnections`)];
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
		const uri = `${environment.baseUrl}/${Core.pathDeterminer(environment.version, '__sdk')}${Core.pathDeterminer(environment.version, 'app')}/${app.name}/${Core.pathDeterminer(environment.version, 'webhook')}`;
		let response = await Core.rpGet(uri, authorization);
		response = environment.version === 1 ? response : response[camelCase(`appWebhooks`)];
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
		let countries;
		let code = 'code';
		if (environment.version === 2) {
			countries = (await Core.rpGet(`${environment.baseUrl}/enums/countries`, authorization)).countries
			code = 'code2'
		} else {
			countries = await Core.rpGet(`${environment.baseUrl}/country`, authorization)
		}
		try {
			return countries.map(country => {
				return {
					label: country.name,
					description: country[code]
				}
			})
		}
		catch (err) {
			vscode.window.showErrorMessage(err.error.message)
		}
	},

	languages: async function (environment, authorization, context) {
		let response;
		if (environment.version === 2) {
			response = (await Core.rpGet(`${environment.baseUrl}/enums/languages`, authorization)).languages
		} else {
			response = await Core.rpGet(`${environment.baseUrl}/language`, authorization)
		}
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
		let envs = configuration.environments.map(e => { return { label: e.name, description: e.uuid } })
		envs.push({ label: "+ Add a new environment", description: "add" })
		return envs
	},

	allApps: async function (environment, authorization) {
		let response;
		if (environment.version === 2) {
			let appsResponse, noOfApps = [], offset = 0
			do {
				appsResponse = (await Core.rpGet(`${environment.baseUrl}/admin/sdk/apps`, authorization, { all: true , "pg[offset]": offset * 10000 }))
				noOfApps = noOfApps.concat(appsResponse.apps)
				offset++
			} while (appsResponse.apps.length === 10000)
			response = noOfApps
		} else {
			response = await Core.rpGet(`${environment.baseUrl}/app`, authorization, { all: true })
		}
		try {
			const apps = [];
			const used = [];
			response.forEach(app => {
				if (!used.includes(app.name)) {
					used.push(app.name);
					apps.push({
						label: app.label,
						description: app.name
					});
				}
			})
			return apps;
		}
		catch (err) {
			vscode.window.showErrorMessage(err.message || err.error.message)
		}
	},

	favApps: async function (environment, authorization) {
		let response;
		if (environment.version === 2) {
			response = (await Core.rpGet(`${environment.baseUrl}/admin/sdk/apps`, authorization)).apps
		} else {
			response = await Core.rpGet(`${environment.baseUrl}/app`, authorization)
		}
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