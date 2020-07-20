const vscode = require('vscode');

const App = require('../tree/App');
const Group = require('../tree/Group')
const Item = require('../tree/Item')
const Code = require('../tree/Code')
const Core = require('../Core');
const Meta = require('../Meta');

const path = require('path')
const mkdirp = require('mkdirp')
const download = require('image-downloader')
const asyncfile = require('async-file')
const camelCase = require('lodash.camelcase');

class AppsProvider {
	constructor(_authorization, _environment, _DIR, _admin) {
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this._authorization = _authorization
		this._environment = _environment;
		this._baseUrl = _environment.baseUrl;
		this._DIR = _DIR
		this._admin = _admin;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getParent(element) {
		return element.parent
	}

	getTreeItem(element) {
		return element
	}

	async getChildren(element) {
        /*
         * LEVEL 0 - APPS
         */
		if (element === undefined) {
			let response;
			switch (this._environment.version) {
				case 2:
					response = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps`, this._authorization, {
						'cols[]': [
							'name', 'label', 'description', 'version', 'beta', 'theme', 'public', 'approved', 'changes'
						]
					})).apps
					break;
				case 1:
				default:
					response = await Core.rpGet(`${this._baseUrl}/app`, this._authorization)
					break;
			}
			if (response === undefined) { return }
			let iconDir = path.join(this._DIR, "icons")
			mkdirp(iconDir)
			let apps = response.map(async (app) => {
				let iconVersion = 1
				let dest = path.join(iconDir, `${app.name}.${iconVersion}.png`)
				while (await asyncfile.exists(`${dest}.old`)) {
					iconVersion++
					dest = path.join(iconDir, `${app.name}.${iconVersion}.png`)
				}
				if (!await asyncfile.exists(dest)) {
					try {
						await download.image({
							headers: {
								"Authorization": this._authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							url: (() => {
								switch (this._environment.version) {
									case 2:
										return `${this._baseUrl}/sdk/apps/${app.name}/${app.version}/icon/512`
									case 1:
									default:
										return `${this._baseUrl}/app/${app.name}/${app.version}/icon/512`
								}
							})(),
							dest: dest
						})
						await Core.invertPngAsync(dest);
					}
					catch (err) {
						if (err != undefined) {
							iconVersion = 0
						}
					}
				}
				if (app.public) {
					if (await asyncfile.exists(dest) && !await asyncfile.exists(`${dest.slice(0, -4)}.public.png`)) {
						await Core.generatePublicIcon(dest);
					}
					if (await asyncfile.exists(`${dest.slice(0, -4)}.dark.png`) && !await asyncfile.exists(`${dest.slice(0, -4)}.dark.public.png`)) {
						await Core.generatePublicIcon(`${dest.slice(0, -4)}.dark.png`);
					}
				}
				return new App(app.name, app.label, app.description, app.version, app.public, app.approved, iconDir, app.theme, app.changes, iconVersion)
			})
			apps = await Promise.all(apps)
			apps.sort(Core.compareApps)
			return apps
		}
        /*
         * LEVEL 1 - GROUP
         */
		else if (element.level === 0) {

			// For each group
			const output = [
				[`general`, "General"],
				[`connections`, "Connections"],
				[`webhooks`, "Webhooks"],
				[`modules`, "Modules"],
				[`rpcs`, "Remote procedures"],
				[`functions`, "Functions"],
				[`docs`, "Docs"]
			].map(group => {

				// Determine the name of group
				let groupItem
				switch (group[0]) {
					case `general`:
						groupItem = "app"
						break
					case `docs`:
						groupItem = "docs"
						break
					default:
						groupItem = group[0].slice(0, -1);
						break
				}

				// Look for changes of the group
				let groupChanges = element.changes.filter(change => {
					if ((change.group === 'account' ? 'connection' : (change.group === 'hook' ? 'webhook' : change.group)) === groupItem && change.code !== "groups") {
						return change
					}
				})

				// Return the group and push the changes into it
				return new Group(group[0], group[1], element, groupChanges)
			})

			// Add Categories
			let groupChange = element.changes.find(change => {
				if (change.code == 'groups') {
					return change
				}
			})
			output.push(new Code('groups', 'Groups', element, "imljson", Core.pathDeterminer(this._environment.version, 'app'), false, groupChange ? groupChange.id : null));
			return output;
		}
        /*
         * LEVEL 2 - ITEM OR CODE
         */
		else if (element.level === 1) {

			// General
			if (element.id.includes("general")) {
				return [
					[`base`, "Base", "Base structure all modules and remote procedures inherits from."],
					[`common`, "Common", "Collection of common data accessible through common.variable expression. Contains sensitive information like API keys or API secrets. This collection is shared across all modules."]
				].map(code => {
					let change = element.changes.find(change => {
						if (change.code == code[0]) {
							return change
						}
					})
					return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'app'), false, change ? change.id : null, code[2])
				})
			}

			// Docs
			else if (element.contextValue === "docs") {
				return [
					new Code(`readme`, "Readme", element, "md", Core.pathDeterminer(this._environment.version, 'app')),
					//new Code(`images`, "Images", element, "img")
				]
			}

			// REST
			else {
				for (let needle of ["connections", "webhooks", "modules", "rpcs", "functions"]) {
					if (element.id.includes(needle)) {
						let name = needle.slice(0, -1);
						let uri = ["connection", "webhook"].includes(name) ?
							`${this._baseUrl}/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${element.parent.name}/${Core.pathDeterminer(this._environment.version, name)}` :
							`${this._baseUrl}/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${element.parent.name}/${element.parent.version}/${Core.pathDeterminer(this._environment.version, name)}`
						let response = await Core.rpGet(uri, this._authorization)
						const items = this._environment.version === 1 ? response : response[camelCase(`app_${needle}`)];
						return items.map(item => {
							let changes = element.changes.filter(change => {
								if (change.item === item.name) {
									return change
								}
							})
							return new Item(item.name, item.label || (item.name + item.args), element, name, item.type || item.type_id || item.typeId, item.public, item.approved, changes, item.description, item.crud)
						})
					}
				}
			}
		}
        /*
         * LEVEL 3 - CODE
         */
		else if (element.level === 2) {
			switch (element.supertype) {
				case "connection":
					return [
						[`api`, "Communication", "Specifies the account validation process. This specification does not inherit from base."],
						[`common`, "Common data", "Collection of common data accessible through common.variable expression. Contains sensitive information like API keys or API secrets."],
						[`scopes`, "Scope list", "Collection of available scopes. (key = scope name, value = human readable scope description)"],
						[`scope`, "Default scope", "Default scope for every new connection. Array of strings."],
						[`parameters`, "Parameters", "Array of parameters user should fill while creating a new connection."]
					].map(code => {
						let change
						if (element.changes) {
							change = element.changes.find(change => {
								if (change.code == code[0]) {
									return change
								}
							})
						}
						return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), false, change ? change.id : null, code[2])
					})
				case "webhook":
					return [
						[`api`, "Communication", "Specification of incoming data processing. This specification does not inherit from base and does not have access to connection."],
						[`parameters`, "Parameters", "Array of parameters user should fill while creating a new webhook."],
						[`attach`, "Attach", "Describes how to register this webhook automatically via API. Leave empty if user needs to register webhook manually. This specification does inherit from base."],
						[`detach`, "Detach", "Describes how to unregister this webhook automatically via API. Leave empty if user needs to unregister webhook manually. This specification does inherit from base."],
						[`scope`, "Required scope", "Scope required by this webhook. Array of strings."]
					].map(code => {
						let change
						if (element.changes) {
							change = element.changes.find(change => {
								if (change.code == code[0]) {
									return change
								}
							})
						}
						return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), false, change ? change.id : null, code[2])
					})
				case "module":
					switch (element.type) {
						// Action or search or universal
						case 4:
						case 9:
						case 12:
							return [
								[`api`, "Communication", "This specification does inherit from base."],
								[`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
								[`expect`, "Mappable parameters", "Array of mappable parameters user can fill while configuring the module. Mappable parameters can contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
								[`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
								[`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"],
								[`scope`, "Scope", "Scope required by this module. Array of strings."]
							].map(code => {
								let change
								if (element.changes) {
									change = element.changes.find(change => {
										if (change.code == code[0]) {
											return change
										}
									})
								}
								return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), false, change ? change.id : null, code[2])
							})
						// Trigger
						case 1:
							return [
								[`api`, "Communication", "This specification does inherit from base."],
								[`epoch`, "Epoch", "Describes how user can choose the point in the past where the trigger should start to process data from."],
								[`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
								[`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
								[`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"],
								[`scope`, "Scope", "Scope required by this module. Array of strings."]
							].map(code => {
								let change
								if (element.changes) {
									change = element.changes.find(change => {
										if (change.code == code[0]) {
											return change
										}
									})
								}
								return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), false, change ? change.id : null, code[2])
							})
						// Instant trigger
						case 10:
							return [
								[`api`, "Communication", "Optional, only use when you need to make additional request for an incoming webhook. This specification does inherit from base."],
								[`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
								[`interface`, "Interface", "Array of output variables. Same syntax as used for parameters."],
								[`samples`, "Samples", "Collection of sample values. (key = variable name, value = sample value)"]
							].map(code => {
								let change
								if (element.changes) {
									change = element.changes.find(change => {
										if (change.code == code[0]) {
											return change
										}
									})
								}
								return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), false, change ? change.id : null, code[2])
							})
						// Responder
						case 11:
							return [
								[`api`, "Communication", "This specification does inherit from base."],
								[`parameters`, "Static parameters", "Array of static parameters user can fill while configuring the module. Static parameters can't contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."],
								[`expect`, "Mappable parameters", "Array of mappable parameters user can fill while configuring the module. Mappable parameters can contain variables from other modules. Parameters are accessible via {{parameters.paramName}}."]
							].map(code => {
								let change
								if (element.changes) {
									change = element.changes.find(change => {
										if (change.code == code[0]) {
											return change
										}
									})
								}
								return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), false, change ? change.id : null, code[2])
							})
					}
				case "rpc":
					return [
						[`api`, "Communication", "This specification does inherit from base."],
						[`parameters`, "Parameters"]
					].map(code => {
						let change
						if (element.changes) {
							change = element.changes.find(change => {
								if (change.code == code[0]) {
									return change
								}
							})
						}
						return new Code(code[0], code[1], element, "imljson", Core.pathDeterminer(this._environment.version, 'rpc'), false, change ? change.id : null, code[2])
					})
				case "function":
					return [
						[`code`, "Code"],
						[`test`, "Test"]
					].map(code => {
						let change
						if (element.changes) {
							change = element.changes.find(change => {
								if (change.code == code[0]) {
									return change
								}
							})
						}
						return new Code(code[0], code[1], element, "js", Core.pathDeterminer(this._environment.version, 'function'), false, change ? change.id : null, code[2])
					})
			}
		}
	}
}

module.exports = AppsProvider