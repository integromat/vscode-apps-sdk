const vscode = require('vscode')

const Core = require('../Core')
const Meta = require('../Meta')

const RpcProvider = require('../providers/RpcProvider')
const ImlProvider = require('../providers/ImlProvider')
const ParametersProvider = require('../providers/ParametersProvider')
const StaticImlProvider = require('../providers/StaticImlProvider')
const TempProvider = require('../providers/TempProvider')
const DataProvider = require('../providers/DataProvider')
const GroupsProvider = require('../providers/GroupsProvider')

const path = require('path')
const fs = require('fs')
const rp = require('request-promise')
const mkdirp = require('mkdirp')
const request = require('request')

class CoreCommands {
	constructor(appsProvider, _authorization, _environment, rpcProvider, imlProvider, parametersProvider, staticImlProvider, tempProvider, dataProvider, groupsProvider) {
		this.appsProvider = appsProvider
		this._authorization = _authorization
		this._environment = _environment
		this.currentRpcProvider = rpcProvider
		this.currentImlProvider = imlProvider
		this.currentParametersProvider = parametersProvider
		this.currentStaticImlProvider = staticImlProvider
		this.currentTempProvider = tempProvider
		this.currentDataProvider = dataProvider
		this.currentGroupsProvider = groupsProvider
		this.staticImlProvider = new StaticImlProvider()
		this.sipInit = false
		this.tempListener = null
	}

    /**
     * Source Uploader
     */
	async sourceUpload(event) {

		// It it's not an APPS SDK file, don't do anything
		if (!event.document.fileName.includes('apps-sdk')) { return }

		// Load the content of the file that's about to be saved
		let file = event.document.getText()

		// Get the URN path of files URI (the right path)
		let right = event.document.fileName.split("apps-sdk")[1]

		// If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
		right = right.replace(/\\/g, "/")

		// If it's an open-source app, don't try to save anything
		if (right.startsWith("/opensource/")) {
			vscode.window.showWarningMessage("Opensource Apps can not be modified.")
			return
		}

		// Build the URL
		let basename = path.basename(right, path.extname(right));
		// Revert api-oauth filename to api
		if (basename === "api-oauth") {
			basename = "api"
		}
		let url = (path.join(path.dirname(right), basename)).replace(/\\/g, "/")

		// Remove webhooks and connections from path as they're not under the APP-NAME endpoint in v2
		if (url.startswith('sdk/') && url.includes('/webhooks/') || url.includes('/connections/')) {
			url = url.split('/')
			url.splice(3, 1)
			url = url.join('/')
		}

		// And compose the URI
		let uri = this._environment.baseUrl + url

		// Prepare request options
		var options = {
			uri: uri,
			method: 'PUT',
			body: file.replace(/\u200B/g, ''),
			headers: {
				"Content-Type": "application/jsonc",
				"Authorization": this._authorization,
				'x-imt-apps-sdk-version': Meta.version
			}
		};
		// ^^^ File Replace kicks off zerospaces which are used for marking the document edited

		// Change the Content-Type header if needed
		if (path.extname(right) === ".js") {
			// JavaScript header for JS files
			options.headers["Content-Type"] = "application/javascript"
		}
		if (path.extname(right) === ".md") {
			// Markdown header for MD files
			options.headers["Content-Type"] = "text/markdown"
		}
		if (path.basename(right) === "common.imljson") {
			// Comments are not allowd in encrypted common data, so only JSON is accepted
			options.headers["Content-Type"] = "application/json"
		}

        /**
         * CODE-UPLOADER
         * Those lines are directly responsible for the code being uploaded
         */
		try {
			// Get the response from server
			let response = JSON.parse(await rp(options))

			// If there's no change to be displayed, end
			if (!response.change || Object.keys(response.change).length === 0) { return }

			// Else refresh the tree, because there's a new change to be displayed
			this.appsProvider.refresh()
		}
		catch (err) {
			// Parse the error and display it
			let e = JSON.parse(err.error)
			vscode.window.showErrorMessage(`${e.name}: ${e.message}`)

			// Get active text editor, if exists, insert zero-space char -> mark changed
			let editor = vscode.window.activeTextEditor
			if (editor !== undefined) {
				editor.insertSnippet(new vscode.SnippetString('\u200B'), editor.selection.anchor)
				// If the code should be formatted, remove the zero-char again
				if (vscode.workspace.getConfiguration('editor', 'formatOnSave').get('formatOnSave')) {
					vscode.commands.executeCommand('editor.action.formatDocument')
				}
			}
		}
	}

    /**
     * Provider Keeper
     */
	async keepProviders(editor) {
		{

			//If undefined, don't do anything
			if (!editor) { return }

			// Get the URN path of files URI (the right path)
			let right = editor.document.fileName.split("apps-sdk")[1]

			// No right, no apps-sdk, don't do anything
			if (!right) { return }

			// If on DOS-base, replace backslashes with forward slashes (on Unix-base it's done already)
			right = right.replace(/\\/g, "/")

			// Prepare data for loaders
			let crumbs = right.split("/")

			// Shift SDK
			if (crumbs[1] === 'sdk') {
				crumbs.shift();
			}

			// If versionable, stash the version
			let version
			if (!isNaN(crumbs[3])) {
				version = crumbs[3]
				crumbs.splice(3, 1)
			}


			/**
			 *   ###              #    #       ####### ######  #######
			 *   ###             # #   #       #       #     #    #
             *   ###            #   #  #       #       #     #    #
             *    #            #     # #       #####   ######     #
             *                 ####### #       #       #   #      #
             *   ###           #     # #       #       #    #     #
             *   ###           #     # ####### ####### #     #    #
			 * 
			 * The version is fixed here, because we didn't know how to make it nonfixed at the time
			 * This should be changed when the connection is separated from the app
			 * It would require it's custom RPCs and custom IMLFunctions
			 */


			// If no version, set 1
			version = version === undefined ? 1 : version;
			let apiPath
			let name
			let app = crumbs[2]

			// If not enough crumbs (=> base/readme) -> remove existing providers and exit.
			if (crumbs.length < 5) {

				// Remove existing RpcProvider
				if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
					this.currentRpcProvider.dispose()
				}

				// Remove existing ParametersProvider
				if (this.currentParametersProvider !== null && this.currentParametersProvider !== undefined) {
					this.currentParametersProvider.dispose()
				}

				if (crumbs[3] === 'base.imljson') {
					apiPath = 'base'
					name = 'base'
				} else if (crumbs[3] === 'groups.imljson') {
					apiPath = 'groups'
					name = 'groups'
				} else {
					// Remove existing ImlProvider
					if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
						this.currentImlProvider.dispose()
					}

					// Remove existing StaticImlProvider
					if (this.currentStaticImlProvider !== null && this.currentStaticImlProvider !== undefined) {
						this.currentStaticImlProvider.dispose()
					}

					// Remove existing TempProvider
					if (this.currentTempProvider !== null && this.currentTempProvider !== undefined) {
						this.currentTempProvider.dispose()
					}

					// Remove existing DataProvider
					if (this.currentDataProvider !== null && this.currentDataProvider !== undefined) {
						this.currentDataProvider.dispose()
					}

					// Remove existing GroupsProvider
					if (this.currentGroupsProvider !== null && this.currentGroupsProvider !== undefined) {
						this.currentGroupsProvider.dispose()
					}

					return
				}
			}

			else {
				apiPath = crumbs[3]
				name = crumbs[5].split(".")[0]
			}

            /**
             * RPC-LOADER
             * RpcLoader loads all RPCs available within the app
             * Following condition specifies where are RPCs allowed
             */
			if (
				((apiPath === "connections" || apiPath === "connection") && name === "parameters") ||
				((apiPath === "webhook" || apiPath === "webhooks") && name === "parameters") ||
				((apiPath === "module" || apiPath === "modules") && (name === "parameters" || name === "expect" || name === "interface" || name === "samples")) ||
				((apiPath === "rpc" || apiPath === "rpcs") && name === "api")
			) {
				// Remove existing RpcProvider
				if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
					this.currentRpcProvider.dispose()
				}

				// RPC list url
				let url = `${this._environment.baseUrl}/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${app}/${version}/${Core.pathDeterminer(this._environment.version, 'rpc')}`

				// Get list of RPCs
				let response = await Core.rpGet(url, this._authorization)
				let items = this._environment.version === 1 ? response : response.appRpcs;
				let rpcs = items.map(rpc => {
					return `rpc://${rpc.name}`
				})

				// Register a new RpcProvider
				this.currentRpcProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, new RpcProvider(rpcs))
			}
			else {

				// If out of scope, remove existing RpcProvider
				if (this.currentRpcProvider !== null && this.currentRpcProvider !== undefined) {
					this.currentRpcProvider.dispose()
				}
			}

            /**
             * IML-LOADER
             * ImlLoader loads all IML functions available within the app
             * Following condition specifies where are IML functions allowed
             */
			if (
				(name === "base" || name === "api" || name === "api-oauth" || name === "epoch" || name === "attach" || name === "detach")
			) {
				// Remove existing ImlProvider
				if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
					this.currentImlProvider.dispose()
				}

				// IML functions list url
				let url = `${this._environment.baseUrl}/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${app}/${version}/${Core.pathDeterminer(this._environment.version, 'function')}`

				// Get list of IML functions
				let response = await Core.rpGet(url, this._authorization)
				let items = this._environment.version === 1 ? response : response.appFunctions;
				let imls = items.map(iml => {
					return `${iml.name}()`
				})

				// Register a new ImlProvider
				this.currentImlProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, new ImlProvider(imls))
			}
			else {

				// If out of scope, remove existing ImlProvider
				if (this.currentImlProvider !== null && this.currentImlProvider !== undefined) {
					this.currentImlProvider.dispose()
				}
			}

            /**
             * PARAMETERS-LOADER
             * VariablesLoader will load all context-related and available IML variables
             * Following condition specifies where and how should be the variables provided
             */

			if (
				apiPath !== 'base' && (name === "api" || name === "api-oauth" || name === "epoch" || name === "attach" || name === "detach")
			) {
				// Remove existing ParametersProvider
				if (this.currentParametersProvider !== null && this.currentParametersProvider !== undefined) {
					this.currentParametersProvider.dispose()
				}

				let parametersProvider = new ParametersProvider(this._authorization, this._environment)
				await parametersProvider.loadParameters(crumbs, version)

				this.currentParametersProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, parametersProvider)
			}

			else {

				// If out of scope, remove existing ParametersProvider
				if (this.currentParametersProvider !== null && this.currentParametersProvider !== undefined) {
					this.currentParametersProvider.dispose()
				}
			}

            /**
             * STATIC-IML-LOADER
             * Static IML loader provides inbuilt IML functions and keywords.
             */

			if (this.sipInit === false) {
				await this.staticImlProvider.initialize()
				this.sipInit = true
			}

			if (
				(name === "base" || name === "api" || name === "api-oauth" || name === "epoch" || name === "attach" || name === "detach")
			) {
				// Reasign Static IML provider
				if (this.currentStaticImlProvider !== null && this.currentStaticImlProvider !== undefined) {
					this.currentStaticImlProvider.dispose()
				}
				this.currentStaticImlProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, this.staticImlProvider)
			}

			else {

				// If out of scope, remove existing StaticImlProvider
				if (this.currentStaticImlProvider !== null && this.currentStaticImlProvider !== undefined) {
					this.currentStaticImlProvider.dispose()
				}
			}

			/**
			 * TEMP-LOADER
			 * Temp loader provides available temp variables in the document
			 */

			if (
				(name === "base" || name === "api" || name === "api-oauth" || name === "epoch" || name === "attach" || name === "detach")
			) {
				// Reasign Temp provider
				if (this.currentTempProvider !== null && this.currentTempProvider !== undefined) {
					this.currentTempProvider.dispose()
				}

				let tempProvider = new TempProvider(name);

				this.currentTempProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, tempProvider)
			}
			else {
				// If out of scope, remove
				if (this.currentTempProvider !== null && this.currentTempProvider !== undefined) {
					this.currentTempProvider.dispose()
				}
			}

			/**
			 * GROUPS-LOADER
			 * Groups loader provides module names for hints in groups.json
			 */
			if (
				(name === "groups")
			) {

				if (this.currentGroupsProvider !== null && this.currentGroupsProvider !== undefined) {
					this.currentGroupsProvider.dispose()
				}

				let url = `${this._environment.baseUrl}/${Core.pathDeterminer(this._environment.version, '__sdk')}${Core.pathDeterminer(this._environment.version, 'app')}/${app}/${version}/${Core.pathDeterminer(this._environment.version, 'module')}`
				let response = await Core.rpGet(url, this._authorization)
				let modules = this._environment.version === 1 ? response : response.appModules;
				let groupsProvider = new GroupsProvider(modules);
				groupsProvider.buildCompletionItems();
				this.currentGroupsProvider = vscode.languages.registerCompletionItemProvider({
					scheme: 'file',
					language: 'imljson'
				}, groupsProvider)

			}
			else {
				// If out of scope, remove
				if (this.currentGroupsProvider !== null && this.currentGroupsProvider !== undefined) {
					this.currentGroupsProvider.dispose()
				}
			}

			/**
			 * DATA-LOADER
			 * Data loader provides connection.data variables in the document
			 */

			if (
				((apiPath === "module" || apiPath === "modules") && name === "api") ||
				((apiPath === "webhook" || apiPath === "webhooks") && (name === "api" || name === "attach" || name === "detach")) ||
				((apiPath === "rpc" || apiPath === "rpcs") && name === "api")
			) {
				if (this.currentDataProvider !== null && this.currentDataProvider !== undefined) {
					this.currentDataProvider.dispose()
				}

				let connection;
				switch (apiPath) {
					case 'rpc':
					case 'rpcs':
						if (this._environment.version === 1) {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/app/${app}/${version}/rpc/${crumbs[4]}`, this._authorization)).connection;
						} else {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps/${app}/${version}/rpcs/${crumbs[4]}`, this._authorization)).appRpc.connection;
						}
						break;
					case 'module':
					case 'modules':
						if (this._environment.version === 1) {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/app/${app}/${version}/module/${crumbs[4]}`, this._authorization)).connection;
						} else {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps/${app}/${version}/modules/${crumbs[4]}`, this._authorization)).appModule.connection;
						}
						break;
					case 'webhook':
					case 'webhooks':
						if (this._environment.version === 1) {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/app/${app}/webhook/${crumbs[4]}`, this._authorization)).connection;
						} else {
							connection = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps/webhooks/${crumbs[4]}`, this._authorization)).appWebhook.connection;
						}
						break;
				}

				if (connection) {
					let connectionType;
					let connectionSource;
					if (this._environment.version === 1) {
						connectionType = (await Core.rpGet(`${this._environment.baseUrl}/app/${app}/connection/${connection}`, this._authorization)).appConnection.type
						connectionSource = (await Core.rpGet(`${this._environment.baseUrl}/app/${app}/connection/${connection}/api`, this._authorization))
					} else {
						connectionType = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps/connections/${connection}`, this._authorization)).appConnection.type
						connectionSource = (await Core.rpGet(`${this._environment.baseUrl}/sdk/apps/connections/${connection}/api`, this._authorization))
					}
					let dataProvider = new DataProvider(connectionSource, connectionType);
					dataProvider.getAvailableVariables();
					this.currentDataProvider = vscode.languages.registerCompletionItemProvider({
						scheme: 'file',
						language: 'imljson'
					}, dataProvider)
				}

				else {
					if (this.currentDataProvider !== null && this.currentDataProvider !== undefined) {
						this.currentDataProvider.dispose()
					}
				}

			}
			else {
				// If out of scope, remove
				if (this.currentDataProvider !== null && this.currentDataProvider !== undefined) {
					this.currentDataProvider.dispose()
				}
			}

		}
	}

	static async register(_DIR, _authorization, _environment) {

        /**
         * OpenSource Loader
         */
		vscode.commands.registerCommand('apps-sdk.load-open-source', async function (item) {

			// Compose directory structure
			let urn = `/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}${(_environment.version !== 2) ? `/${Core.getApp(item).name}` : ''}`
			let urnForFile = `/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.getApp(item).name}`

			// Add version to URN for versionable items
			if (Core.isVersionable(item.apiPath)) {
				urn += `${(_environment.version === 2) ? `/${Core.getApp(item).name}` : ''}/${Core.getApp(item).version}`
				urnForFile += `/${Core.getApp(item).version}`
			}

			// Complete the URN by the type of item
			switch (item.apiPath) {
				case "function":
				case "functions":
					urn += `/${item.apiPath}/${item.parent.name}/code`
					urnForFile += `/${item.apiPath}/${item.parent.name}/code`
					break
				case "rpc":
				case "rpcs":
				case "module":
				case "modules":
				case "connection":
				case "connections":
				case "webhook":
				case "webhooks":
					urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
					urnForFile += `/${item.apiPath}/${item.parent.name}/${item.name}`
					break
				case "app":
				case "apps":
					// Prepared for more app-level codes
					switch (item.name) {
						case "readme":
							urn += `/readme`
							urnForFile += `/readme`
							break
						default:
							urn += `/${item.name}`
							urnForFile += `/${item.name}`
							break;
					}
					break
			}

			// Prepare filepath and dirname for the code
			let filepath = `${urnForFile}.${item.language}`
			let dirname = path.dirname(filepath)

            /**
             * CODE-LOADER
             * Code loader loads the requested code
             */

			// Prepare the directory for the code 
			mkdirp(path.join(_DIR, "opensource", dirname), function (err) {

				// If something went wrong, throw an error and return
				if (err) {
					vscode.window.showErrorMessage(err.message)
					return
				}

				// Compose a download URL
				let url = _environment.baseUrl + urn

                /**
                 * GET THE SOURCE CODE
                 * Those lines are responsible straight for the download of code
                 */
				request({
					url: url,
					headers: {
						'Authorization': _authorization,
						'x-imt-apps-sdk-version': Meta.version
					}
				}, function (error, response, body) {

					// Prepare a stream to be saved
					let write = (item.language === "js" || item.language === "md") ? body : Core.formatJsonc(body)

					// Save the received code to the temp directory
					fs.writeFile(path.join(_DIR, "opensource", filepath), write, { mode: 440 }, function (err) {

						// If there was an error, display it and return
						if (err) {
							return vscode.window.showErrorMessage(err.message);
						}

						// Open the downloaded code in the editor
						vscode.window.showTextDocument(vscode.workspace.openTextDocument(path.join(_DIR, "opensource", filepath)), {
							preview: false
						})
					});
				});

			})
		})

        /**
         * Source Loader
         */
		vscode.commands.registerCommand('apps-sdk.load-source', async function (item) {

			// Compose directory structure
			let urn = `/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}${(_environment.version !== 2) ? `/${Core.getApp(item).name}` : ''}`
			let urnForFile = `/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${Core.getApp(item).name}`

			// Add version to URN for versionable items
			if (Core.isVersionable(item.apiPath)) {
				urn += `${(_environment.version === 2) ? `/${Core.getApp(item).name}` : ''}/${Core.getApp(item).version}`
				urnForFile += `/${Core.getApp(item).version}`
			}

			// Complete the URN by the type of item
			switch (item.apiPath) {
				case "function":
				case "functions":
					urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
					urnForFile += `/${item.apiPath}/${item.parent.name}/${item.name}`
					break
				case "rpc":
				case "rpcs":
				case "module":
				case "modules":
				case "connection":
				case "connections":
				case "webhook":
				case "webhooks":
					urn += `/${item.apiPath}/${item.parent.name}/${item.name}`
					urnForFile += `/${item.apiPath}/${item.parent.name}/${item.name}`
					break
				case "app":
				case "apps":
					// Prepared for more app-level codes
					switch (item.name) {
						case "content":
							urn += `/readme`
							urnForFile += `/readme`
							break
						default:
							urn += `/${item.name}`
							urnForFile += `/${item.name}`
							break;
					}
					break
			}

			// Prepare filepath and dirname for the code
			let filepath = `${urnForFile}.${item.language}`
			let dirname = path.dirname(filepath)

			// Special case: OAuth connection API
			if (item.parent.supertype === "connection" && item.parent.type === "oauth" && item.name === "api") {
				filepath = `${urnForFile}-oauth.${item.language}`
			}

            /**
             * CODE-LOADER
             * Code loader loads the requested code
             */

			// Prepare the directory for the code 
			mkdirp(path.join(_DIR, dirname), function (err) {

				// If something went wrong, throw an error and return
				if (err) {
					vscode.window.showErrorMessage(err.message)
					return
				}

				// Compose a download URL
				let url = _environment.baseUrl + urn

                /**
                 * GET THE SOURCE CODE
                 * Those lines are responsible straight for the download of code
                 */
				request({
					url: url,
					headers: {
						'Authorization': _authorization,
						'x-imt-apps-sdk-version': Meta.version
					}
				}, function (error, response, body) {

					// Prepare a stream to be saved
					let write = (item.language === "js" || item.language === "md") ? body : Core.formatJsonc(body)

					// Save the received code to the temp directory
					fs.writeFile(path.join(_DIR, filepath), write, function (err) {

						// If there was an error, display it and return
						if (err) {
							return vscode.window.showErrorMessage(err.message);
						}

						// Open the downloaded code in the editor
						vscode.window.showTextDocument(vscode.workspace.openTextDocument(path.join(_DIR, filepath)), {
							preview: true
						})
					});
				});

			})
		})
	}
}

module.exports = CoreCommands