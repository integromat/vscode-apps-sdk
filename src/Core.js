const Jimp = require('jimp');
const rp = require('request-promise');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const jsoncParser = require('jsonc-parser');
const Meta = require('./Meta');

module.exports = {
	invertPngAsync: async function (uri) {
		return new Promise((reject, resolve) => {
			Jimp
				.read(uri)
				.then(icon => {
					icon
						.invert()
						.write(`${uri.slice(0, -4)}.dark.png`, () => {
							resolve()
						})
				})
				.catch(err => {
					console.error(err);
					reject()
				});
		})
	},

	generatePublicIcon: async function (uri) {
		const icon = await Jimp.read(uri);
		const mask = await Jimp.read(path.join(__dirname, '..', 'resources', 'icons', 'masks', 'public.png'));
		icon.blit(mask, 320, 320);
		await icon.write(`${uri.slice(0, -4)}.public.png`);
	},

	rpGet: async function (uri, authorization, qs) {
		return rp({
			url: uri,
			json: true,
			headers: {
				'Authorization': authorization,
				'x-imt-apps-sdk-version': Meta.version
			},
			qs: qs
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message || err)
		})
	},

	getApp: function (item) {
		return item.parent === undefined ? item : this.getApp(item.parent)
	},

	isVersionable: function (item) {
		return !(["connection", "webhook", "connections", "webhooks"].includes(item))
	},

	contextGuard: function (context) {
		if (context === undefined || context === null) {
			vscode.window.showErrorMessage("This command should not be called directly. Please use it from application context menu.")
			return false
		}
		return true
	},

	envGuard: function (environment, available) {
		if (!(available.includes(environment.version))) {
			vscode.window.showErrorMessage(`Not available in this version of Integromat.`);
			return false;
		}
		return true;
	},

	isFilled: function (subject, object, thing, article, the) {
		if (thing === undefined || thing === "" || thing === null) {
			vscode.window.showWarningMessage(`${article || "A"} ${subject} for ${the === false ? "" : "the"} ${object} has not been specified.`)
			return false
		}
		return true
	},

	addEntity: function (authorization, body, uri) {
		return rp({
			method: 'POST',
			uri: uri,
			body: body,
			headers: {
				Authorization: authorization,
				'x-imt-apps-sdk-version': Meta.version
			},
			json: true
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	deleteEntity: function (authorization, body, uri) {
		return rp({
			method: 'DELETE',
			uri: uri,
			body: body,
			headers: {
				Authorization: authorization,
				'x-imt-apps-sdk-version': Meta.version
			},
			json: true
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	editEntity: function (authorization, body, uri) {
		return rp({
			method: 'PUT',
			uri: uri,
			body: body,
			headers: {
				Authorization: authorization,
				'x-imt-apps-sdk-version': Meta.version
			},
			json: true
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	patchEntity: function (authorization, body, uri) {
		return rp({
			method: 'PATCH',
			uri: uri,
			body: body,
			headers: {
				Authorization: authorization,
				'x-imt-apps-sdk-version': Meta.version
			},
			json: true
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	editEntityPlain: function (authorization, value, uri) {
		return rp({
			method: 'PUT',
			uri: uri,
			body: value,
			headers: {
				Authorization: authorization,
				"Content-Type": "text/plain",
				'x-imt-apps-sdk-version': Meta.version
			}
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	executePlain: function (authorization, value, uri) {
		return rp({
			method: 'POST',
			uri: uri,
			body: value,
			headers: {
				Authorization: authorization,
				"Content-Type": "text/plain",
				'x-imt-apps-sdk-version': Meta.version
			}
		}).catch(err => {
			vscode.window.showErrorMessage(err.error.message)
		})
	},

	getAppObject: async function (environment, authorization, app) {
		try {
			if (environment.version === 2) {
				return (await this.rpGet(`${environment.baseUrl}/sdk/apps/${app.name}/${app.version}`, authorization)).app
			} else {
				return await this.rpGet(`${environment.baseUrl}/app/${app.name}/${app.version}`, authorization)
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(err.error.message)
		}
	},

	getIconHtml: function (uri, color, dir) {
		return (fs.readFileSync(path.join(dir, 'static', 'icon.html'), "utf8")).replace("___iconbase", uri).replace("___theme", color)
	},

	getRpcTestHtml: function (name, app, version, dir) {
		return (fs.readFileSync(path.join(dir, 'static', 'rpc-test.html'), "utf8")).replace("___rpcName", name).replace("___appName", app).replace("___version", version)
	},

	getUdtGeneratorHtml: function (dir) {
		return (fs.readFileSync(path.join(dir, 'static', 'udt-gen.html'), 'utf-8'));
	},

	getAppDetailHtml: function (dir) {
		return (fs.readFileSync(path.join(dir, 'static', 'app-detail.html'), 'utf-8'));
	},

	getModuleDetailHtml: function (dir) {
		return (fs.readFileSync(path.join(dir, 'static', 'module-detail.html'), 'utf-8'));
	},

	compareCountries: function (a, b) {
		// Sort by PICK
		if (a.picked && !b.picked) return -1;
		if (b.picked && !a.picked) return 1;

		// Sort by NAME
		return a.label.localeCompare(b.label)
	},

	compareApps: function (a, b) {
		return a.bareLabel.localeCompare(b.bareLabel)
	},

	formatJsonc: function (text) {
		let edits = jsoncParser.format(text, undefined, { insertSpaces: true, tabSize: 4, keepLines: true })
		let formatted = jsoncParser.applyEdits(text, edits)
		return formatted
	},

	jsonString: function (text, sectionGuard) {

		// Section Guard to prevent NULLs in exported filed
		if (sectionGuard !== undefined) {
			if (text === null) {
				if (sectionGuard === "samples") {
					text = {};
				} else {
					text = [];
				}
			}
		}

		if (typeof text === 'object' && text !== null) {
			return JSON.stringify(text, null, 4)
		}
		return text
	},

	translateModuleTypeId: function (typeId) {
		switch (typeId) {
			case 1: return 'Trigger';
			case 4: return 'Action';
			case 9: return 'Search';
			case 10: return 'Instant Trigger';
			case 11: return 'Responder';
			case 12: return 'Universal';
			default: return 'Unknown';
		}
	},

	pathDeterminer: (version, originalPath) => {
		switch (version) {
			case 2:
				switch (originalPath) {
					case 'app':
						return 'apps';
					case 'connection':
						return 'connections';
					case 'webhook':
						return 'webhooks';
					case 'module':
						return 'modules';
					case 'rpc':
						return 'rpcs';
					case 'function':
						return 'functions';
					case 'change':
						return 'changes';
					case '__sdk':
						return 'sdk/'
					default:
						return ''
				}
			case 1:
			default:
				switch (originalPath) {
					case '__sdk':
						return ''
					default:
						return originalPath;
				}
		}
	}
}