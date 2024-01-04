/* eslint-disable semi,@typescript-eslint/no-var-requires */
const vscode = require('vscode');
const App = require('../tree/App');
const Group = require('../tree/Group')
const Item = require('../tree/Item')
const Code = require('../tree/Code')
const Core = require('../Core');
const camelCase = require('lodash.camelcase');
const { downloadAndStoreAppIcon } = require('../libs/app-icon');

class OpensourceProvider /* implements vscode.TreeDataProvider<Dependency> */ {
	constructor(_authorization, _environment, _DIR) {
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
		this._authorization = _authorization
		this._environment = _environment;
		this._baseUrl = _environment.baseUrl;
		this._DIR = _DIR
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
					// ! opensource filter is not available on admin endpoint
					response = (await Core.rpGet(`${this._environment.baseUrl.replace('/admin', '')}/sdk/apps`, this._authorization, {
						opensource: true,
						'cols[]': [
							'name', 'label', 'description', 'version', 'beta', 'theme', 'public', 'approved', 'changes'
						]
					})).apps
					break;
				case 1:
				default:
					response = await Core.rpGet(`${this._baseUrl}/app`, this._authorization, { opensource: true })
					break;
			}
			if (response === undefined) { return }

			const apps = await Promise.all(response.map(async (app) => {
				const iconVersion = await downloadAndStoreAppIcon(app, this._baseUrl, this._authorization, this._environment, true);
				return new App(app.name, app.label, app.description, app.version, app.public, app.approved, app.theme, app.changes, iconVersion, true);
			}));
			apps.sort(Core.compareApps)
			return apps
		}
        /*
         * LEVEL 1 - GROUP
         */
		else if (element.level === 0) {
			return [
				new Group(`general`, "General", element),
				new Group(`connections`, "Connections", element),
				new Group(`webhooks`, "Webhooks", element),
				new Group(`modules`, "Modules", element),
				new Group(`rpcs`, "Remote procedures", element),
				new Group(`functions`, "IML functions", element),
				new Group(`docs`, "Docs", element)
			]
		}
        /*
         * LEVEL 2 - ITEM OR CODE
         */
		else if (element.level === 1) {
			// General
			if (element.id.includes("general")) {
				return [
					new Code(`base`, "Base", element, "imljson", Core.pathDeterminer(this._environment.version, 'app'), true),
					new Code(`common`, "Common", element, "imljson", Core.pathDeterminer(this._environment.version, 'app'), true)
				]
			}
			// Docs
			else if (element.id.includes("docs")) {
				return [
					new Code(`readme`, "Readme", element, "md", Core.pathDeterminer(this._environment.version, 'app'), true),
					//new Code(`images`, "Images", element, "img", true)
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
						return items.map(item => new Item(item.name, item.label || (item.name + item.args), element, name, item.type || item.type_id || item.typeId, item.public, item.approved))
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
						new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), true),
						new Code(`common`, "Common data", element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), true),
						new Code(`scopes`, "Scope list", element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), true),
						new Code(`scope`, "Default scope", element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), true),
						new Code(`parameters`, "Parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'connection'), true)
					]
				case "webhook": {
					const out = [
						new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true),
						new Code(`parameters`, "Parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true),
						new Code(`attach`, "Attach", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true),
						new Code(`detach`, "Detach", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true),
						new Code(`scope`, "Required scope", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true),
					];
					if (this._environment.version === 2) {
						out.push(new Code(`update`, "Update", element, "imljson", Core.pathDeterminer(this._environment.version, 'webhook'), true));
					}
					return out;
				}
				case "module":
					switch (element.type) {
						// Action or search
						case 4:
						case 9:
							return [
								new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`parameters`, "Static parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`expect`, "Mappable parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`interface`, "Interface", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`samples`, "Samples", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`scope`, "Scope", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
							]
						// Trigger
						case 1:
							return [
								new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`epoch`, "Epoch", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`parameters`, "Static parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`interface`, "Interface", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`samples`, "Samples", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`scope`, "Scope", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
							]
						// Instant trigger
						case 10:
							return [
								new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`parameters`, "Static parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`expect`, "Interface", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`samples`, "Samples", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true)
							]
						// Responder
						case 11:
							return [
								new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`parameters`, "Static parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true),
								new Code(`expect`, "Mappable parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'module'), true)
							]
					}
					break;
				case "rpc":
					return [
						new Code(`api`, "Communication", element, "imljson", Core.pathDeterminer(this._environment.version, 'rpc'), true),
						new Code(`parameters`, "Parameters", element, "imljson", Core.pathDeterminer(this._environment.version, 'rpc'), true)
					]
				case "function":
					return [
						new Code(`code`, "Code", element, "js", Core.pathDeterminer(this._environment.version, 'function'), true)
					]
			}
		}
	}
}

module.exports.OpensourceProvider = OpensourceProvider;
