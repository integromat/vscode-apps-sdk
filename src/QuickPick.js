/* eslint-disable semi */
const Core = require('./Core');
const camelCase = require('lodash/camelCase');
const { showError } = require('./error-handling');

module.exports = {
	connections: async function (environment, authorization, app, allow_no) {
		const uri = `${environment.baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer('app')}/${app.name}/${Core.pathDeterminer('connection')}`;
		const response = (await Core.rpGet(uri, authorization))[camelCase(`appConnections`)];
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
			showError(err);
		}
	},

	webhooks: async function (environment, authorization, app, allow_no) {
		const uri = `${environment.baseUrl}/${Core.pathDeterminer('__sdk')}${Core.pathDeterminer('app')}/${app.name}/${Core.pathDeterminer('webhook')}`;
		const response = (await Core.rpGet(uri, authorization))[camelCase(`appWebhooks`)];
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
			showError(err);
		}
	},

	countries: async function (environment, authorization) {
		const code = 'code2';
		const countries = (await Core.rpGet(`${environment.baseUrl}/enums/countries`, authorization)).countries
		try {
			return countries.map(country => {
				return {
					label: country.name,
					description: country[code]
				}
			})
		}
		catch (err) {
			showError(err);
		}
	},

	languages: async function (environment, authorization, context) {
		const response = (await Core.rpGet(`${environment.baseUrl}/enums/languages`, authorization)).languages
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
		let appsResponse, noOfApps = [], offset = 0
		do {
			appsResponse = await Core.rpGet(`${environment.baseUrl}/admin/sdk/apps`, authorization, { all: true , "pg[offset]": offset * 10000 })
			noOfApps = noOfApps.concat(appsResponse.apps)
			offset++
		} while (appsResponse.apps.length === 10000)
		const response = noOfApps
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
			showError(err);
		}
	},

	favApps: async function (environment, authorization) {
		const response = (await Core.rpGet(`${environment.baseUrl}/admin/sdk/apps`, authorization)).apps
		try {
			return response.map(app => {
				return {
					label: app.label,
					description: app.name
				}
			})
		}
		catch (err) {
			showError(err);
		}
	}
}
