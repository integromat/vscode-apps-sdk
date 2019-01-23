const vscode = require('vscode')

const Core = require('../Core')
const Validator = require('../Validator')
const QuickPick = require('../QuickPick')
const Enum = require('../Enum')
const Meta = require('../Meta')

const kebabCase = require('lodash.kebabcase')
const fs = require('fs')
const request = require('request')
const path = require('path')
const rp = require('request-promise')
const asyncfile = require('async-file')
const tempy = require('tempy')

class AppCommands {
	static async register(appsProvider, _authorization, _environment, _admin) {

		// IF ADMIN, remap new app to favadd
		if (_admin === true) {
            /**
             * NEW APP - ADMIN MODE
             */
			vscode.commands.registerCommand('apps-sdk.app.new', async function () {

				// Get list of all apps
				let allApps = await QuickPick.allApps(_environment, _authorization)

				if (!allApps) {
					return vscode.window.showErrorMessage('No apps available.')
				}

				// Get list of favorite apps
				let favApps = await QuickPick.favApps(_environment, _authorization)

				// Precheck current favorite apps
				favApps.forEach(favApp => {
					allApps.find(function (app) {
						if (app.description === favApp.description) {
							app.picked = true
							return true
						}
						return false
					})
				});

				// Show the quickpick and wait for response
				let newFavs = await vscode.window.showQuickPick(allApps, {
					canPickMany: true,
					placeHolder: "Choose favorite apps to be displayed in the sidebar."
				})

				if (newFavs === undefined) {
					return vscode.window.showWarningMessage("Selection canceled.")
				}

				// No need of labels anymore, get only names of old favs and new favs
				favApps = favApps.map(favApp => { return favApp.description })
				newFavs = newFavs.map(newFav => { return newFav.description })

				// Filter apps to be added
				let appsToAdd = newFavs.filter(newFav => {
					return !favApps.includes(newFav)
				})

				// Filter apps to be removed
				let appsToRemove = favApps.filter(favApp => {
					return !newFavs.includes(favApp)
				})

				let changes = false

				// If there are some apps to be added
				if (appsToAdd.length > 0) {
					await Core.addEntity(_authorization, { name: appsToAdd }, `${_environment}/favorite`)
					changes = true
				}

				// If there are some apps to be removed
				if (appsToRemove.length > 0) {
					await Core.deleteEntity(_authorization, { name: appsToRemove }, `${_environment}/favorite`)
					changes = true
				}

				// If there were some changes, refresh the app tree
				if (changes === true) {
					appsProvider.refresh()
				}
			})
		}
		else {
            /**
             * New APP - NORMAL MODE
             */
			vscode.commands.registerCommand('apps-sdk.app.new', async function () {

				// Label prompt
				let label = await vscode.window.showInputBox({ prompt: "Enter app label" })
				if (!Core.isFilled("label", "app", label)) { return }

				// Id prompt
				let id = await vscode.window.showInputBox({
					prompt: "Enter app Id",
					value: kebabCase(label),
					validateInput: Validator.appName
				})
				if (!Core.isFilled("id", "app", id, "An")) { return }

				// Color theme prompt and check
				let theme = await vscode.window.showInputBox({
					prompt: "Pick a color theme",
					value: "#000000"
				})
				if (!Core.isFilled("theme", "app", theme)) { return }
				if (!(/^#[0-9A-F]{6}$/i.test(theme))) {
					vscode.window.showErrorMessage("Entered color was invalid.")
					return
				}

				// Language prompt
				let language = await vscode.window.showQuickPick(QuickPick.languages(_environment, _authorization), { placeHolder: "Choose app language." })
				if (!Core.isFilled("language", "app", language)) { return }

				// Countries prompt
				let countries = await vscode.window.showQuickPick(QuickPick.countries(_environment, _authorization), {
					canPickMany: true,
					placeHolder: "Choose app countries. If left blank, app will be considered as global."
				})
				if (!Core.isFilled("country", "app", countries)) { return }

				// Build URI and prepare countries list
				let uri = `${_environment}/app`
				countries = countries.map(item => { return item.description })

				// Send the request
				try {
					await Core.addEntity(_authorization, {
						"name": id,
						"label": label,
						"theme": theme,
						"language": language.description,
						"private": true,
						"countries": countries
					}, uri)
					appsProvider.refresh()
				}
				catch (err) {
					vscode.window.showErrorMessage(err.error.message || err)
				}
			})
		}

        /**
         * Edit app
         */
		vscode.commands.registerCommand('apps-sdk.app.edit-metadata', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }

			// Get the app from the API (will be used in future)
			let app = await Core.getAppObject(_environment, _authorization, context)

			// Label prompt with prefilled value
			let label = await vscode.window.showInputBox({
				prompt: "Customize app label",
				value: context.bareLabel
			})
			if (!Core.isFilled("label", "app", label)) { return }

			// Theme prompt with prefilled value
			let theme = await vscode.window.showInputBox({
				prompt: "Customize app theme",
				value: context.theme,
				validateInput: Validator.appTheme
			})
			if (!Core.isFilled("theme", "app", theme)) { return }

			// Prepare languages -> place current language to the top, then prompt
			let languages = await QuickPick.languages(_environment, _authorization)
			languages.unshift({ label: "Keep current", description: app.language })
			let language = await vscode.window.showQuickPick(languages, { placeHolder: "Choose app language" })
			if (!Core.isFilled("language", "app", language)) { return }

			// Prepare countries -> get current coutries and precheck them, sort by check and alphabet, then prompt
			let countries = await QuickPick.countries(_environment, _authorization)
			if (app.countries !== null) {
				countries = countries.map(country => {
					if (app.countries.includes(country.description)) {
						country.picked = true
					}
					return country
				})
				countries.sort(Core.compareCountries)
			}
			countries = await vscode.window.showQuickPick(countries, {
				canPickMany: true,
				placeHolder: "Choose app countries. If left blank, app will be considered as global."
			})
			if (!Core.isFilled("country", "app", countries)) { return }

			// Build URI and prepare countries list
			let uri = `${_environment}/app/${context.name}/${context.version}`
			countries = countries.map(country => { return country.description })
			countries = countries.length > 0 ? countries : undefined

			// Send the request
			try {
				await Core.editEntity(_authorization, {
					label: label,
					theme: theme,
					language: language.description,
					countries: countries
				}, uri)
				appsProvider.refresh()
			}
			catch (err) {
				vscode.window.showErrorMessage(err.error.message || err)
			}
		})

        /**
         * Delete app
         */
		vscode.commands.registerCommand('apps-sdk.app.delete', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete this app?` })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If was confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage(`Stopped. No apps were deleted.`)
					break
				case "Yes":
					// Set URI and send the request
					let uri = `${_environment}/app/${app.name}/${app.version}`
					try {
						await rp({
							method: 'DELETE',
							uri: uri,
							headers: {
								Authorization: _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							json: true
						})
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}
		})

        /**
         * Edit app icon
         */
		vscode.commands.registerCommand('apps-sdk.app.get-icon', function (app) {

			// If called directly (by using a command pallete) -> die
			if (!Core.contextGuard(app)) { return }

			// Create a new WebviewPanel object
			const panel = vscode.window.createWebviewPanel(
				`${app.name}_icon`,
				`${app.label} icon`,
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			)

			// Prepare variable for storing the base64
			let buff

			// If the icon exists on the disc -> get its BASE64
			if (fs.existsSync(app.iconPath.dark)) {
				buff = new Buffer(fs.readFileSync(app.iconPath.dark)).toString('base64')
			}

			// If not, use the BASE64 of blank 512*512 png square
			else {
				buff = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADZJREFUeJztwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0niJ8AAAAABJRU5ErkJggg=="
			}

			// Inject the theme color and the icon to the generated HTML
			panel.webview.html = Core.getIconHtml(buff, app.theme, path.join(__dirname, '..', '..'))

            /**
             * Change handler
             */
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.command === "change-icon") {

					// Show open file dialog and wait for a new file URI
					let uri = await vscode.window.showOpenDialog({
						canSelectFolders: false,
						canSelectMany: false,
						filters: {
							'Images': ['png']
						},
						openLabel: "Upload"
					})

					// If no URI supplied -> die
					if (uri === undefined) {
						return
					}

					// Prepare request options
					let options = {
						url: `${_environment}/app/${app.name}/${app.version}/icon`,
						headers: {
							'Authorization': _authorization,
							'x-imt-apps-sdk-version': Meta.version
						}
					}

					// Read the new file and fire the request
					fs.createReadStream(uri[0].fsPath).pipe(request.put(options, async function (err, response) {

						// Parse the response
						response = JSON.parse(response.body)

						// If there was an error, show the message
						if (response.name === "Error") {
							vscode.window.showErrorMessage(response.message)
						}

						// If everything has gone well, close the webview panel and refresh the tree (the new icon will be loaded)
						else {

							if (await asyncfile.exists(app.iconPath.dark)) {
								await asyncfile.rename(app.iconPath.dark, `${app.iconPath.dark}.old`)
							}
							if (await asyncfile.exists(app.iconPath.light)) {
								await asyncfile.rename(app.iconPath.light, `${app.iconPath.light}.old`)
							}

							vscode.commands.executeCommand('apps-sdk.refresh')
							panel.dispose()
						}
					}))
				}
			}, undefined)
		})

        /**
         * Mark app as private
         */
		vscode.commands.registerCommand('apps-sdk.app.visibility.private', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.hide, { placeHolder: `Do you really want to mark this app as private?` })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If was confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage(`The app has been kept as public.`)
					break
				case "Yes":
					// Set URI and send the request
					let uri = `${_environment}/app/${app.name}/${app.version}/private`
					try {
						await Core.executePlain(_authorization, "", uri)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}

		})

        /**
         * Mark app as public
         */
		vscode.commands.registerCommand('apps-sdk.app.visibility.public', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context

			// Wait for confirmation
			let answer = await vscode.window.showQuickPick(Enum.publish, { placeHolder: `Do you really want to mark this app as public?` })
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage("No answer has been recognized.")
				return
			}

			// If was confirmed or not
			switch (answer.label) {
				case "No":
					vscode.window.showInformationMessage(`The app has been kept as private.`)
					break
				case "Yes":
					// Set URI and send the request
					let uri = `${_environment}/app/${app.name}/${app.version}/public`
					try {
						await Core.executePlain(_authorization, "", uri)
						appsProvider.refresh()
					}
					catch (err) {
						vscode.window.showErrorMessage(err.error.message || err)
					}
					break
			}
		})

		/**
		 * Export app
		 */
		vscode.commands.registerCommand('apps-sdk.app.export', async function (context) {

			// Context check
			if (!Core.contextGuard(context)) { return }
			let app = context
			const RATE_LIMIT_MS = 600
			const DIR = tempy.directory()
			console.log(`Will now export ${app.label}.`);

			const archive = path.join(DIR, app.name, app.version.toString())
			await asyncfile.mkdir(path.join(DIR, app.name));
			await asyncfile.mkdir(archive);
			const urnNoVersion = `${_environment}/app/${app.name}`
			const urn = `${_environment}/app/${app.name}/${app.version}`

			/**
			 * 1 - Get App Metadata
			 */
			console.log(`${app.name}/META`)
			await asyncfile.writeFile(path.join(archive, `metadata.json`), JSON.stringify(await Core.rpGet(`${urn}`, _authorization), null, 4));
			await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

			/**
			 * 2 - Get Base
			 */
			console.log(`${app.name}/base`)
			await asyncfile.writeFile(path.join(archive, `base.imljson`), Core.jsonString(await Core.rpGet(`${urn}/base`, _authorization)))
			await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

			/**
			 * 3 - Get Common
			 */
			console.log(`${app.name}/common`)
			await asyncfile.writeFile(path.join(archive, `common.json`), JSON.stringify(await Core.rpGet(`${urn}/common`, _authorization), null, 4))
			await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

			/**
			 * 4 - Get Docs
			 */
			console.log(`${app.name}/docs`)
			await asyncfile.writeFile(path.join(archive, `docs.md`), await Core.rpGet(`${urn}/docs`, _authorization))
			await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

			/**
			 * 5 - Get Connections
			 */
			const connections = await Core.rpGet(`${urnNoVersion}/connection`, _authorization);
			await asyncfile.mkdir(path.join(archive, 'connection'))
			for (const connection of connections) {
				const archivePath = path.join(archive, 'connection', connection.name)
				await asyncfile.mkdir(archivePath)

				// Get Connection Metadata
				console.log(`${app.name}/connection/${connection.name}/META`)
				await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(await Core.rpGet(`${urnNoVersion}/connection/${connection.name}`, _authorization), null, 4));
				await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

				// Get Corresponding Sources
				for (const key of [`api`, `scope`, `scopes`, `parameters`]) {
					console.log(`${app.name}/connection/${connection.name}/${key}`)
					await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urnNoVersion}/connection/${connection.name}/${key}`, _authorization)))
					await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
				}

				// Get Connection Common
				console.log(`${app.name}/connection/${connection.name}/common`)
				await asyncfile.writeFile(path.join(archivePath, `common.json`), JSON.stringify(await Core.rpGet(`${urnNoVersion}/connection/${connection.name}/common`, _authorization), null, 4));
				await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
			}

			/**
			 * 6 - Get RPCs
			 */
			const rpcs = await Core.rpGet(`${urn}/rpc`, _authorization);
			await asyncfile.mkdir(path.join(archive, 'rpc'))
			for (const rpc of rpcs) {
				const archivePath = path.join(archive, 'rpc', rpc.name)
				await asyncfile.mkdir(archivePath)

				// Get RPC Metadata
				console.log(`${app.name}/rpc/${rpc.name}/META`)
				await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(await Core.rpGet(`${urn}/rpc/${rpc.name}`, _authorization), null, 4));
				await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

				// Get Corresponding Sources
				for (const key of [`api`, `parameters`]) {
					console.log(`${app.name}/rpc/${rpc.name}/${key}`)
					await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urn}/rpc/${rpc.name}/${key}`, _authorization)))
					await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
				}
			}

			/**
			 * 7 - Get Webhooks
			 */
			const webhooks = await Core.rpGet(`${urnNoVersion}/webhook`, _authorization);
			await asyncfile.mkdir(path.join(archive, 'webhook'))
			for (const webhook of webhooks) {
				const archivePath = path.join(archive, 'webhook', webhook.name)
				await asyncfile.mkdir(archivePath)

				// Get Webhook Metadata
				console.log(`${app.name}/webhook/${webhook.name}/META`)
				await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(await Core.rpGet(`${urnNoVersion}/webhook/${webhook.name}`, _authorization), null, 4));
				await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

				// Get Corresponding Sources
				for (const key of [`api`, `parameters`, `attach`, `detach`, `scope`]) {
					console.log(`${app.name}/webhook/${webhook.name}/${key}`)
					await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urnNoVersion}/webhook/${webhook.name}/${key}`, _authorization)))
					await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
				}
			}

			/**
			 * 8 - Get Modules
			 */
			const modules = await Core.rpGet(`${urn}/module`, _authorization);
			await asyncfile.mkdir(path.join(archive, 'module'))
			for (const module of modules) {
				const archivePath = path.join(archive, 'module', module.name)
				await asyncfile.mkdir(archivePath)

				// Get Module Metadata
				console.log(`${app.name}/module/${module.name}/META`)
				await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(await Core.rpGet(`${urn}/module/${module.name}`, _authorization), null, 4));
				await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

				// Get Corresponding Sources Based On Type
				switch (module.type_id) {

					// Action or search
					case 4:
					case 9:
						for (const key of [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`]) {
							console.log(`${app.name}/module/${module.name}/${key}`)
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urn}/module/${module.name}/${key}`, _authorization)))
							await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
						}
						break;
					// Trigger
					case 1:
						for (const key of [`api`, `epoch`, `parameters`, `interface`, `samples`, `scope`]) {
							console.log(`${app.name}/module/${module.name}/${key}`)
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urn}/module/${module.name}/${key}`, _authorization)))
							await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
						}
						break;
					// Instant trigger
					case 10:
						for (const key of [`api`, `parameters`, `interface`, `samples`]) {
							console.log(`${app.name}/module/${module.name}/${key}`)
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urn}/module/${module.name}/${key}`, _authorization)))
							await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
						}
						break;
					// Responder
					case 11:
						for (const key of [`api`, `parameters`, `expect`]) {
							console.log(`${app.name}/module/${module.name}/${key}`)
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`), Core.jsonString(await Core.rpGet(`${urn}/module/${module.name}/${key}`, _authorization)))
							await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
						}
						break;
				}
			}

			/**
			 * 9 - Get Functions
			 */
			const functions = await Core.rpGet(`${urn}/function`, _authorization);
			await asyncfile.mkdir(path.join(archive, 'function'))
			for (const fun of functions) {
				const archivePath = path.join(archive, 'function', fun.name)
				await asyncfile.mkdir(archivePath)

				// Get Corresponding Sources
				for (const key of [`code`, `test`]) {
					console.log(`${app.name}/function/${fun.name}/${key}`)
					await asyncfile.writeFile(path.join(archivePath, `${key}.js`), await Core.rpGet(`${urn}/function/${fun.name}/${key}`, _authorization))
					await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
				}
			}


			console.log(`Done`);
			console.log(archive);
		})
	}
}

module.exports = AppCommands