/* eslint-disable semi,@typescript-eslint/no-var-requires */
const vscode = require('vscode');

const Core = require('../Core');
const Validator = require('../Validator');
const QuickPick = require('../QuickPick');
const Enum = require('../Enum');
const Meta = require('../Meta');
const Felicia = require('../Felicia');

const kebabCase = require('lodash.kebabcase');
const pick = require('lodash.pick');
const download = require('image-downloader');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const asyncfile = require('async-file');
const tempy = require('tempy');
const compressing = require('compressing');
const AdmZip = require('adm-zip');
const camelCase = require('lodash.camelcase');
const { showError, catchError } = require('../error-handling');
const { promisify2 } = require('../utils');

class AppCommands {
	static async register(appsProvider, _authorization, _environment, _admin) {

		// IF ADMIN, remap new app to favadd
		if (_admin === true) {
			/**
			 * NEW APP - ADMIN MODE
			 */
			vscode.commands.registerCommand('apps-sdk.app.new', catchError('New app creation', async () => {
				// Get list of all apps
				const allApps = await QuickPick.allApps(_environment, _authorization);

				if (!allApps) {
					return vscode.window.showErrorMessage('No apps available.');
				}

				// Get list of favorite apps
				let favApps = await QuickPick.favApps(_environment, _authorization);

				// Precheck current favorite apps
				favApps.forEach(favApp => {
					allApps.find((app) => {
						if (app.description === favApp.description) {
							app.picked = true;
							return true;
						}
						return false;
					});
				});

				// Show the quickpick and wait for response
				let newFavs = await vscode.window.showQuickPick(allApps, {
					canPickMany: true,
					placeHolder: 'Choose favorite apps to be displayed in the sidebar.'
				});

				if (newFavs === undefined) {
					return vscode.window.showWarningMessage('Selection canceled.');
				}

				// No need of labels anymore, get only names of old favs and new favs
				favApps = favApps.map(favApp => {
					return favApp.description;
				});
				newFavs = newFavs.map(newFav => {
					return newFav.description;
				});

				// Filter apps to be added
				const appsToAdd = newFavs.filter(newFav => {
					return !favApps.includes(newFav);
				});

				// Filter apps to be removed
				const appsToRemove = favApps.filter(favApp => {
					return !newFavs.includes(favApp);
				});

				let changes = false;

				if (_environment.version === 2) {
					// If there are some apps to be added
					if (appsToAdd.length > 0) {
						await Core.addEntity(_authorization, { name: appsToAdd }, `${_environment.baseUrl}/admin/sdk/apps/favorites`);
						changes = true;
					}

					// If there are some apps to be removed
					if (appsToRemove.length > 0) {
						await Core.deleteEntity(_authorization, { name: appsToRemove }, `${_environment.baseUrl}/admin/sdk/apps/favorites`);
						changes = true;
					}
				} else {
					// If there are some apps to be added
					if (appsToAdd.length > 0) {
						await Core.addEntity(_authorization, { name: appsToAdd }, `${_environment.baseUrl}/favorite`);
						changes = true;
					}

					// If there are some apps to be removed
					if (appsToRemove.length > 0) {
						await Core.deleteEntity(_authorization, { name: appsToRemove }, `${_environment.baseUrl}/favorite`);
						changes = true;
					}
				}

				// If there were some changes, refresh the app tree
				if (changes === true) {
					appsProvider.refresh();
				}
			}));
		} else {
			/**
			 * New APP - NORMAL MODE
			 */
			vscode.commands.registerCommand('apps-sdk.app.new', catchError('New app creation', async () => {
				// Label prompt
				const label = await vscode.window.showInputBox({
					prompt:
						'Enter app label'
				});

				if (!Core.isFilled('label', 'app', label)) {
					return;
				}

				// Id prompt
				const id = await vscode.window.showInputBox({
					prompt: 'Enter app Id',
					value: kebabCase(label),
					validateInput: Validator.appName
				});
				if (!Core.isFilled('id', 'app', id, 'An')) {
					return;
				}

				let version = 1;
				if ([2].includes(_environment.version)) {
					let response = await Core.rpGet(`${_environment.baseUrl}/users/me`, _authorization);

					//check if a user have "Can create Apps without ID suffix" feature on admin
					if (response && response.authUser && response.authUser.features && response.authUser.features.allow_apps) {
						// Version Propmpt
						version = await vscode.window.showInputBox({
							prompt: 'Enter app version, if you\'re not creating a new version of an existing app, keep 1',
							value: version
						});
					}
					if (!Core.isFilled('version', 'app', version, 'A')) {
						return;
					}
				}

				// Description propmpt
				const description = await vscode.window.showInputBox({
					prompt: 'Enter app description'
				});

				if (!Core.isFilled('description', 'app', description)) {
					return;
				}

				// Color theme prompt and check
				const theme = await vscode.window.showInputBox({
					prompt: 'Pick a color theme',
					value: '#000000'
				});
				if (!Core.isFilled('theme', 'app', theme)) {
					return;
				}
				if (!(/^#[0-9A-F]{6}$/i.test(theme))) {
					vscode.window.showErrorMessage('Entered color was invalid.');
					return;
				}

				// Language prompt
				const language = await vscode.window.showQuickPick(QuickPick.languages(_environment, _authorization), { placeHolder: 'Choose app language.' });
				if (!Core.isFilled('language', 'app', language)) {
					return;
				}

				// Countries prompt
				let countries = await vscode.window.showQuickPick(QuickPick.countries(_environment, _authorization), {
					canPickMany: true,
					placeHolder: 'Choose app countries. If left blank, app will be considered as global.'
				});
				if (!Core.isFilled('country', 'app', countries)) {
					return;
				}

				// Build URI and prepare countries list
				const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}`;
				countries = countries.map(item => {
					return item.description;
				});

				// Send the request
				if (_environment.version === 2) {
					// TODO : Language not sent, formula tweak needed
					await Core.addEntity(_authorization, {
						'name': id,
						'label': label,
						'version': parseInt(version) || 1,
						'description': description,
						'theme': theme,
						'language': language.description,
						'audience': countries.length === 0 ? 'global' : 'countries',
						'countries': countries.length === 0 ? undefined : countries
					}, uri);
				} else {
					await Core.addEntity(_authorization, {
						'name': id,
						'label': label,
						'description': description,
						'theme': theme,
						'language': language.description,
						'private': true,
						'countries': countries
					}, uri);
				}
				appsProvider.refresh();

			}));
		}

		/**
		 * Edit app
		 */
		vscode.commands.registerCommand('apps-sdk.app.edit-metadata', catchError('Edit metadata', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) {
				return;
			}

			// Get the app from the API (will be used in future)
			const app = await Core.getAppObject(_environment, _authorization, context);

			// Label prompt with prefilled value
			const label = await vscode.window.showInputBox({
				prompt: 'Customize app label',
				value: context.bareLabel
			});
			if (!Core.isFilled('label', 'app', label)) {
				return;
			}

			// Description prompt with prefilled value
			const description = await vscode.window.showInputBox({
				prompt: 'Customize app description',
				value: app.description
			});
			if (!Core.isFilled('description', 'app', description)) {
				return;
			}

			// Theme prompt with prefilled value
			const theme = await vscode.window.showInputBox({
				prompt: 'Customize app theme',
				value: context.theme,
				validateInput: Validator.appTheme
			});
			if (!Core.isFilled('theme', 'app', theme)) {
				return;
			}

			// Prepare languages -> place current language to the top, then prompt
			const languages = await QuickPick.languages(_environment, _authorization);
			languages.unshift({ label: 'Keep current', description: app.language });
			const language = await vscode.window.showQuickPick(languages, { placeHolder: 'Choose app language' });
			if (!Core.isFilled('language', 'app', language)) {
				return;
			}

			// Prepare countries -> get current coutries and precheck them, sort by check and alphabet, then prompt
			let countries = await QuickPick.countries(_environment, _authorization);
			if (app.countries !== null) {
				countries = countries.map(country => {
					if (app.countries.includes(country.description)) {
						country.picked = true;
					}
					return country;
				});
				countries.sort(Core.compareCountries);
			}
			countries = await vscode.window.showQuickPick(countries, {
				canPickMany: true,
				placeHolder: 'Choose app countries. If left blank, app will be considered as global.'
			});
			if (!Core.isFilled('country', 'app', countries)) {
				return;
			}

			// Build URI and prepare countries list
			const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}`;
			countries = countries.map(country => {
				return country.description;
			});
			countries = countries.length > 0 ? countries : undefined;

			// Send the request
			if (_environment.version === 2) {
				await Core.patchEntity(_authorization, {
					label: label,
					theme: theme,
					description: description,
					language: language.description,
					audience: countries === undefined ? 'global' : 'countries',
					countries: countries
				}, uri);
			} else {
				await Core.editEntity(_authorization, {
					label: label,
					theme: theme,
					description: description,
					language: language.description,
					countries: countries
				}, uri);
			}
			appsProvider.refresh();
		}));

		/**
		 * Delete app
		 */
		vscode.commands.registerCommand('apps-sdk.app.delete', catchError('Delete app', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) {
				return;
			}

			// Wait for confirmation
			const answer = await vscode.window.showQuickPick(Enum.delete, { placeHolder: `Do you really want to delete the app "${context.label}"?` });
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage('No answer has been recognized.');
				return;
			}

			// If was confirmed or not
			switch (answer.label) {
				case 'No':
					vscode.window.showInformationMessage(`Stopped. No apps were deleted.`);
					return;
				case 'Yes': {
					// Set URI and send the request
					const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}`;
					await axios({
						method: 'DELETE',
						url: uri,
						headers: {
							'Authorization': _authorization,
							'x-imt-apps-sdk-version': Meta.version
						},
					});
					appsProvider.refresh();
					vscode.window.showInformationMessage(`App "${context.label}" deleted.`);
					break;
				}
			}
		}));

		/**
		 * Edit app icon
		 */
		vscode.commands.registerCommand('apps-sdk.app.get-icon', catchError('Get/change icon', async (app) => {

			// If called directly (by using a command pallete) -> die
			if (!Core.contextGuard(app)) {
				return;
			}

			// Create a new WebviewPanel object
			const panel = vscode.window.createWebviewPanel(
				`${app.name}_icon`,
				`${app.label} icon`,
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);

			// Prepare variable for storing the base64
			let buff;

			// If the icon exists on the disc -> get its BASE64
			if (fs.existsSync(app.rawIcon.dark)) {
				buff = Buffer.from(fs.readFileSync(app.rawIcon.dark)).toString('base64');
			} else {
				// If not, use the BASE64 of blank 512*512 png square
				// eslint-disable-next-line max-len
				buff = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADZJREFUeJztwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0niJ8AAAAABJRU5ErkJggg==';
			}

			// Inject the theme color and the icon to the generated HTML
			panel.webview.html = Core.getIconHtml(buff, app.theme, path.join(__dirname, '..', '..'));

			panel.webview.onDidReceiveMessage(catchError('Icon change', async (message) => {
				/**
				 * The icon change (upload new one).
				 *
				 * Called when user clicks on the "Change icon" button, which calls command "change-icon".
				 */
				if (message.command === 'change-icon') {

					// Show open file dialog and wait for a new file URI
					const uri = await vscode.window.showOpenDialog({
						canSelectFolders: false,
						canSelectMany: false,
						filters: {
							'Images': ['png']
						},
						openLabel: 'Upload'
					});

					// If no URI supplied -> die
					if (uri === undefined) {
						return;
					}

					// Upload the new icon via REST API.

					// Prepare request options
					const options = {
						url: `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/icon`,
						method: 'PUT',
						headers: {
							'Authorization': _authorization,
							'x-imt-apps-sdk-version': Meta.version,
							'Content-Type': 'image/png',
						}
					};

					// Read the new file and fire the request
					await axios({
						...options,
						data: fs.createReadStream(uri[0].fsPath),
					});

					// If everything has gone well, close the webview panel and refresh the tree (the new icon will be loaded)
					if (await asyncfile.exists(app.rawIcon.dark)) {
						await asyncfile.rename(app.rawIcon.dark, `${app.rawIcon.dark}.old`);
					}
					if (await asyncfile.exists(app.rawIcon.light)) {
						await asyncfile.rename(app.rawIcon.light, `${app.rawIcon.light}.old`);
					}

					vscode.commands.executeCommand('apps-sdk.refresh');
					panel.dispose();

					vscode.window.showInformationMessage(`New icon saved.`);
				}
			}), undefined);
		}));

		/**
		 * Show app detail
		 */
		vscode.commands.registerCommand('apps-sdk.app.show-detail', catchError('Show app detail', async (context) => {

			// If called directly (by using a command pallete) -> die
			if (!Core.contextGuard(context)) {
				return;
			}

			const urn = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}`;
			let app = await Core.rpGet(`${urn}`, _authorization);

			// ApiFlip
			if (_environment.version === 2) {
				app = app.app;
			}

			const languages = await QuickPick.languages(_environment, _authorization);
			app.language = languages.find(language => language.description === app.language);

			const countries = await QuickPick.countries(_environment, _authorization);
			app.countries = (app.countries && app.countries.length > 0) ?
				countries.filter(country => app.countries.includes(country.description)) :
				[{ label: 'Global', description: 'global' }];

			if (fs.existsSync(context.rawIcon.dark)) {
				app.icon = Buffer.from(fs.readFileSync(context.rawIcon.dark)).toString('base64');
			} else {
				// If not, use the BASE64 of blank 512*512 png square
				// eslint-disable-next-line max-len
				app.icon = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIAAQMAAADOtka5AAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADZJREFUeJztwQEBAAAAgiD/r25IQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfBuCAAAB0niJ8AAAAABJRU5ErkJggg==';
			}

			const panel = vscode.window.createWebviewPanel(
				`${app.name}_detail`,
				`${app.label} detail`,
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			if (_environment.version === 2) {
				app.modules = (await Core.rpGet(`${urn}/modules`, _authorization)).appModules.map(m => m.approved);
				app.rpcsCount = (await Core.rpGet(`${urn}/rpcs`, _authorization)).appRpcs.length;
			} else {
				app.modules = (await Core.rpGet(`${urn}/module`, _authorization)).map(m => m.approved);
				app.rpcsCount = (await Core.rpGet(`${urn}/rpc`, _authorization)).length;
			}

			panel.webview.html = Core.getAppDetailHtml(path.join(__dirname, '..', '..'));

			// ApiFlip
			if (app.manifestVersion) {
				app.manifest_version = app.manifestVersion;
			}
			if (app.public !== undefined) {
				app.private = !(app.public)
			}

			panel.webview.postMessage(app);

		}));

		/**
		 * Mark app as private
		 */
		vscode.commands.registerCommand('apps-sdk.app.visibility.private', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) {
				return;
			}
			const app = context;

			// Wait for confirmation
			const answer = await vscode.window.showQuickPick(Enum.hide, { placeHolder: `Do you really want to mark this app as private?` });
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage('No answer has been recognized.');
				return;
			}

			// If was confirmed or not
			switch (answer.label) {
				case 'No':
					vscode.window.showInformationMessage(`The app has been kept as public.`);
					break;
				case 'Yes': {
					// Set URI and send the request
					const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/private`;
					try {
						await Core.executePlain(_authorization, '', uri);
						appsProvider.refresh();
					} catch (err) {
						showError(err);
					}
					break;
				}
			}

		});

		/**
		 * Mark app as public
		 */
		vscode.commands.registerCommand('apps-sdk.app.visibility.public', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) {
				return;
			}
			const app = context;

			// Wait for confirmation
			const answer = await vscode.window.showQuickPick(Enum.publish, { placeHolder: `Do you really want to mark this app as public?` });
			if (answer === undefined || answer === null) {
				vscode.window.showWarningMessage('No answer has been recognized.');
				return;
			}

			// If was confirmed or not
			switch (answer.label) {
				case 'No':
					vscode.window.showInformationMessage(`The app has been kept as private.`);
					break;
				case 'Yes': {
					// Set URI and send the request
					const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${app.name}/${app.version}/public`;
					try {
						await Core.executePlain(_authorization, '', uri);
						appsProvider.refresh();
					} catch (err) {
						showError(err);
					}
					break;
				}
			}
		});

		/**
		 * Export app
		 */
		vscode.commands.registerCommand('apps-sdk.app.export', async (context) => {

			// Context check
			if (!Core.contextGuard(context)) {
				return;
			}
			const app = context;

			// Wait for a path for ZIP
			const storage = await vscode.window.showSaveDialog({
				filters: { 'IMT App Archive': ['zip'] },
				saveLabel: 'Export', defaultUri: vscode.Uri.file(`${app.name}.v${app.version}.zip`)
			});
			if (storage === undefined || storage === null) {
				vscode.window.showWarningMessage('No output file specified.');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Exporting ${app.label}`,
				cancellable: true
			}, async (progress, token) => {

				let canceled = false;
				progress.report({ increment: 0, message: `${app.label} - Preparing for export` });
				const DIR = tempy.directory();
				token.onCancellationRequested(() => {
					vscode.window.showWarningMessage(`Export of ${app.label} canceled.`);
					canceled = true;
				});

				let progressPercentage;

				const archive = path.join(DIR, app.name);
				await asyncfile.mkdir(archive);
				const urnNoVersion = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}`;
				const urnNoApp = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}${_environment.version !== 2 ? `/${context.name}` : ''}`;
				const urn = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}`;

				try {
					/**
					 * 1 - Get App Metadata
					 */
					if (canceled) {
						return;
					}
					progress.report({ increment: 2, message: `${app.label} - Gathering Metadata` });
					let a = await Core.rpGet(`${urn}`, _authorization);
					if (_environment.version === 2) { a = a.app }
					await asyncfile.writeFile(path.join(archive, `metadata.json`), JSON.stringify(pick(a, ['name', 'label', 'version', 'theme', 'language', 'countries']), null, 4));

					/**
					 * 2 - Get Base
					 */
					if (canceled) {
						return;
					}
					progress.report({ increment: 2, message: `${app.label} - Exporting Base` });
					await asyncfile.writeFile(path.join(archive, `base.imljson`), Core.jsonString(await Core.rpGet(`${urn}/base`, _authorization)));

					/**
					 * 3 - Get Readme
					 */
					if (canceled) {
						return;
					}
					progress.report({ increment: 2, message: `${app.label} - Exporting Readme` });
					await asyncfile.writeFile(path.join(archive, `readme.md`), (await Core.rpGet(`${urn}/readme`, _authorization) || ''));

					/**
					 * 4 - Get Connections
					 */
					if (canceled) {
						return;
					}
					let connections = await Core.rpGet(`${urnNoVersion}/${Core.pathDeterminer(_environment.version, 'connection')}`, _authorization);
					if (_environment.version === 2) { connections = connections.appConnections }
					if (connections.length === 0) {
						progress.report({ increment: 7, message: `${app.label} - No Connections (skipping)` });
					} else {
						progressPercentage = 7 / connections.length;
					}
					await asyncfile.mkdir(path.join(archive, 'connections'));
					for (const connection of connections) {
						if (canceled) {
							return;
						}
						const archivePath = path.join(archive, 'connections', connection.name);
						await asyncfile.mkdir(archivePath);

						// Get Connection Metadata
						progress.report({
							increment: 0.125 * progressPercentage, message: `${app.label} - Exporting Connection ${connection.label} (metadata)`
						});
						let c = (await Core.rpGet(`${urnNoApp}/${Core.pathDeterminer(_environment.version, 'connection')}/${connection.name}`, _authorization));
						if (_environment.version === 2) { c = c.appConnection }
						await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(pick(c, ['name', 'label', 'type']), null, 4));

						// Get Corresponding Sources
						for (const key of [`api`, `scope`, `scopes`, `parameters`]) {
							progress.report({
								increment: (0.875 * progressPercentage) * (0.25), message: `${app.label} - Exporting Connection ${connection.label} (${key})`
							});
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
								Core.jsonString(await Core.rpGet(`${urnNoApp}/${Core.pathDeterminer(_environment.version, 'connection')}/${connection.name}/${key}`, _authorization), key));
						}
					}

					/**
					 * 5 - Get RPCs
					 */
					if (canceled) {
						return;
					}
					let rpcs = await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'rpc')}`, _authorization);
					if (_environment.version === 2) { rpcs = rpcs.appRpcs }
					if (rpcs.length === 0) {
						progress.report({ increment: 17, message: `${app.label} - No RPCs (skipping)` });
					} else {
						progressPercentage = 17 / rpcs.length;
					}
					await asyncfile.mkdir(path.join(archive, 'rpcs'));
					for (const rpc of rpcs) {
						if (canceled) {
							return;
						}
						const archivePath = path.join(archive, 'rpcs', rpc.name);
						await asyncfile.mkdir(archivePath);

						// Get RPC Metadata
						progress.report({ increment: (0.25 * progressPercentage), message: `${app.label} - Exporting RPC ${rpc.label} (metadata)` });
						let r = (await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'rpc')}/${rpc.name}`, _authorization));
						if (_environment.version === 2) { r = r.appRpc }
						await asyncfile.writeFile(path.join(archivePath, `metadata.json`),
							JSON.stringify(pick(r, ['name', 'label', 'connection']), null, 4));

						// Get Corresponding Sources
						for (const key of [`api`, `parameters`]) {
							progress.report({ increment: (0.75 * progressPercentage) * (0.5), message: `${app.label} - Exporting RPC ${rpc.label} (${key})` });
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
								Core.jsonString(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'rpc')}/${rpc.name}/${key}`, _authorization), key));
						}
					}

					/**
					 * 6 - Get Webhooks
					 */
					if (canceled) {
						return;
					}
					let webhooks = await Core.rpGet(`${urnNoVersion}/${Core.pathDeterminer(_environment.version, 'webhook')}`, _authorization);
					if (_environment.version === 2) { webhooks = webhooks.appWebhooks }
					if (webhooks.length === 0) {
						progress.report({ increment: 12, message: `${app.label} - No Webhooks (skipping)` });
					} else {
						progressPercentage = 12 / webhooks.length;
					}
					await asyncfile.mkdir(path.join(archive, 'webhooks'));
					for (const webhook of webhooks) {
						if (canceled) {
							return;
						}
						const archivePath = path.join(archive, 'webhooks', webhook.name);
						await asyncfile.mkdir(archivePath);

						// Get Webhook Metadata
						progress.report({ increment: 0.1 * progressPercentage, message: `${app.label} - Exporting Webhook ${webhook.label} (metadata)` });
						let w = await Core.rpGet(`${urnNoApp}/${Core.pathDeterminer(_environment.version, 'webhook')}/${webhook.name}`, _authorization)
						if (_environment.version === 2) { w = w.appWebhook }
						await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(pick(w, ['name', 'label', 'connection', 'type']), null, 4));

						// Get Corresponding Sources
						for (const key of [`api`, `parameters`, `attach`, `detach`, `scope`].concat(_environment.version === 2 ? [`update`] : [])) {
							progress.report({
								increment: (0.9 * progressPercentage) * (0.2), message: `${app.label} - Exporting Webhook ${webhook.label} (${key})`
							});
							await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
								Core.jsonString(await Core.rpGet(`${urnNoApp}/${Core.pathDeterminer(_environment.version, 'webhook')}/${webhook.name}/${key}`, _authorization), key));
						}
					}

					/**
					 * 7 - Get Modules
					 */
					if (canceled) {
						return;
					}
					let modules = await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}`, _authorization);
					if (_environment.version === 2) { modules = modules.appModules }
					if (modules.length === 0) {
						progress.report({ increment: 41, message: `${app.label} - No Modules (skipping)` });
					} else {
						progressPercentage = 41 / modules.length;
					}
					await asyncfile.mkdir(path.join(archive, 'modules'));
					for (const module of modules) {
						if (canceled) {
							return;
						}
						if (_environment.version === 2) { module.type_id = module.typeId; delete module.typeId; }
						const archivePath = path.join(archive, 'modules', module.name);
						await asyncfile.mkdir(archivePath);

						// Get Module Metadata
						progress.report({ increment: 0.07 * progressPercentage, message: `${app.label} - Exporting Module ${module.label} (metadata)` });
						let m = await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}/${module.name}`, _authorization)
						if (_environment.version === 2) { m = m.appModule; m.type_id = m.typeId; delete m.typeId }
						const metadata = pick(m, ['name', 'label', 'description', 'type_id', 'connection', 'webhook']);
						switch (metadata.type_id) {
							case 1:
								metadata.type = 'trigger';
								break;
							case 4:
								metadata.type = 'action';
								break;
							case 9:
								metadata.type = 'search';
								break;
							case 10:
								metadata.type = 'instant_trigger';
								break;
							case 11:
								metadata.type = 'responder';
								break;
							case 12:
								metadata.type = 'universal';
								break;
						}
						delete metadata.type_id;
						await asyncfile.writeFile(path.join(archivePath, `metadata.json`), JSON.stringify(metadata, null, 4));

						// Get Corresponding Sources Based On Type
						switch (module.type_id) {

							// Action or search
							case 4:
							case 9:
							case 12:
								for (const key of [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`]) {
									progress.report({
										increment: (0.93 * progressPercentage) * (0.16), message: `${app.label} - Exporting Module ${module.label} (${key})`
									});
									await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
										Core.jsonString(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}/${module.name}/${key}`, _authorization), key));
								}
								break;
							// Trigger
							case 1:
								for (const key of [`api`, `epoch`, `parameters`, `interface`, `samples`, `scope`]) {
									progress.report({
										increment: (0.93 * progressPercentage) * (0.16), message: `${app.label} - Exporting Module ${module.label} (${key})`
									});
									await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
										Core.jsonString(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}/${module.name}/${key}`, _authorization), key));
								}
								break;
							// Instant trigger
							case 10:
								for (const key of [`api`, `parameters`, `interface`, `samples`]) {
									progress.report({
										increment: (0.93 * progressPercentage) * (0.25), message: `${app.label} - Exporting Module ${module.label} (${key})`
									});
									await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
										Core.jsonString(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}/${module.name}/${key}`, _authorization), key));
								}
								break;
							// Responder
							case 11:
								for (const key of [`api`, `parameters`, `expect`]) {
									progress.report({
										increment: (0.93 * progressPercentage) * (0.33), message: `${app.label} - Exporting Module ${module.label} (${key})`
									});
									await asyncfile.writeFile(path.join(archivePath, `${key}.imljson`),
										Core.jsonString(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'module')}/${module.name}/${key}`, _authorization), key));
								}
								break;
						}
					}

					/**
					 * 8 - Get Functions
					 */
					if (canceled) {
						return;
					}
					let functions = await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'function')}`, _authorization);
					if (_environment.version === 2) { functions = functions.appFunctions }
					if (functions.length === 0) {
						progress.report({ increment: 7, message: `${app.label} - No Functions (skipping)` });
					} else {
						progressPercentage = 7 / functions.length;
					}
					await asyncfile.mkdir(path.join(archive, 'functions'));
					for (const fun of functions) {
						if (canceled) {
							return;
						}
						const archivePath = path.join(archive, 'functions', fun.name);
						await asyncfile.mkdir(archivePath);

						// Get Corresponding Sources
						for (const key of [`code`, `test`]) {
							progress.report({
								increment: progressPercentage * 0.5, message: `${app.label} - Exporting Function ${fun.name}${fun.args} (${key})`
							});
							await asyncfile.writeFile(path.join(archivePath, `${key}.js`),
								(await Core.rpGet(`${urn}/${Core.pathDeterminer(_environment.version, 'function')}/${fun.name}/${key}`, _authorization)) || '');
						}
					}

					/**
					 * 9 - Get Icon
					 */
					if (canceled) {
						return;
					}
					progress.report({ increment: 3, message: `${app.label} - Exporting Icon` });
					await asyncfile.mkdir(path.join(archive, 'assets'));
					try {
						await download.image({
							headers: {
								'Authorization': _authorization,
								'x-imt-apps-sdk-version': Meta.version
							},
							url: `${urn}/icon/512`,
							dest: path.join(archive, 'assets', 'icon.png')
						});
					} catch (err) { }

					/**
					 * 10 - Note the format
					 */
					if (canceled) {
						return
					}
					await asyncfile.writeFile(path.join(archive, `.sdk`), JSON.stringify({
						version: 2
					}, null, 4));

					/**
					 * 11 - Compress and save
					 */
					if (canceled) {
						return;
					}
					progress.report({ increment: 5, message: `${app.label} - Compressing output` });
					await compressing.zip.compressDir(archive, storage.fsPath).catch((err) => {
						showError(err, 'Saving failed');
					});
				} catch (err) {
					showError(err);
				}
			});
			vscode.window.showInformationMessage(`Export of ${app.label} completed!`);
		});

		/**
		 * Import app
		 */
		vscode.commands.registerCommand('apps-sdk.app.import', catchError('Import app from ZIP', async () => {

			const deduplicate = (arr) => {
				const out = [];
				for (const e of arr) {
					if (!(out.includes(e))) {
						out.push(e);
					}
				}
				return out;
			};

			const parseComponent = async (validator, entries, metadata, key, codes, extension, requireMetadata = true) => {
				return Promise.all(deduplicate(entries
					.filter(entry => {
						return (entry.entryName.match(`${metadata.name}/${key}/.+`)) && !(entry.entryName.startsWith(`__MAC`)) && (entry.isDirectory === false)
					})
					.map(entry => entry.entryName.split('/')[2]))
					.filter(filename => !(['.DS_Store'].includes(filename)))
					.map(async (internalName) => {
						const component = {};
						if (requireMetadata === true) {
							const metadataEntry = entries.find(entry => (
								entry.entryName === `${metadata.name}/${key}/${internalName}/metadata.json`)
							);
							if (!metadataEntry) {
								throw new Error('File metadata.json not found in ZIP, but required.');
							}
							const data/*: Buffer*/ = await promisify2(metadataEntry.getDataAsync)();
							component.metadata = JSON.parse(data.toString());

							// Universal module subtype
							if (key === 'modules' && component.metadata.type === 'universal') {
								component.metadata.subtype = 'Universal'
							}

							validator.count++;
						}
						await Promise.all((Array.isArray(codes) ? codes : codes[component.metadata.type]).map(async (code) => {
							component[code] = (await new Promise(resolve => {
								const entry = entries.find(entry => entry.entryName === `${metadata.name}/${key}/${internalName}/${code}.${extension}`);
								if (entry) {
									return entry.getDataAsync((data => {
										resolve(data);
									}));
								} else {
									resolve('{}');
								}
							})).toString();

							// Fix null value -- DON'T FORGET TO CHANGE IN CORE COMMANDS WHEN CHANGING THIS
							// Happends on legacy Integromat only, where DB null value is directly returned without filling the default value "{}"|"[]"
							if (component[code] === "null") {
								if (code === "samples") {
									component[code] = '{}';
								} else {
									component[code] = '[]';
								}
							}

							// Hack for top-level RPC calls
							if (component[code].startsWith('rpc://')) {
								component[code] = `"${component[code]}"`;
							}

							validator.count++;
						}));
						return component;
					}));
			};

			/**
			 * @returns {Promise<Buffer>}
			 */
			const getData = async (validator, entries, searchPath) => {
				const entry = entries.find(entry => entry.entryName === searchPath);
				if (!entry) {
					throw new Error(`ZIP entry "${searchPath}" not found, but required.`);
				}
				validator.count++;
				return promisify2(entry.getDataAsync)();
			};

			const makeRequestProto = (_label, endpoint, method, contentType, body, _store = undefined, _replaceInBody = undefined) => {
				return {
					endpoint: endpoint,
					method: method,
					type: contentType,
					body: body,
					_store: _store,
					_replaceInBody: _replaceInBody,
					_label: _label
				};
			};

			const extract = (obj, keys) => {
				const out = {};
				keys.forEach(key => {
					out[key] = obj[key];
				});
				return out;
			};

			const replaceSlugs = (store, uri) => {
				Object.keys(store).forEach(key => {
					if (uri.includes(key)) {
						uri = uri.replace(key, store[key]);
					}
				});
				return uri;
			};

			const parseApp = async (entries) => {
				const validator = {
					count: 0
				};
				const app = {};

				// Try to get app metadata from the raw zip path
				const e = entries.find(entry => entry.entryName.match(/^([a-z][0-9a-z-]+[0-9a-z]\/metadata\.json)/));
				if (!e) {
					throw new Error('App archive corrupted. (metadata.json not resolved correctly)');
				}
				const data/*: Buffer*/ = await promisify2(e.getDataAsync)();
				validator.count++;
				/** JSON content of `metadata.json` file */
				app.metadata = JSON.parse(data.toString());


				// Get .sdk metadata raw directly
				const _sdk = JSON.parse((await new Promise(resolve => {
					const f = entries.find(entry => entry.entryName.match(`${app.metadata.name}/.sdk`));
					if (f) {
						f.getDataAsync((data => {
							resolve(data.toString());
						}));
					} else {
						// Resolve with default data
						resolve(JSON.stringify({
							version: 1
						}));
					}
				})));

				app.base = (await getData(validator, entries, `${app.metadata.name}/base.imljson`)).toString();
				app.readme = (await getData(validator, entries, `${app.metadata.name}/readme.md`)).toString();
				try {
					app.icon = await getData(validator, entries, `${app.metadata.name}/assets/icon.png`);
				} catch (e) {
					app.icon = undefined;
				}
				app.connections = await parseComponent(validator, entries, app.metadata, Core.pathDeterminer(_sdk.version, 'connection'), [`api`, `scope`, `scopes`, `parameters`], 'imljson');
				app.rpcs = await parseComponent(validator, entries, app.metadata, Core.pathDeterminer(_sdk.version, 'rpc'), [`api`, `parameters`], 'imljson');
				app.webhooks = await parseComponent(validator, entries, app.metadata, Core.pathDeterminer(_sdk.version, 'webhook'), [`api`, `parameters`, `attach`, `detach`, `scope`, `update`], 'imljson');
				app.modules = await parseComponent(validator, entries, app.metadata, Core.pathDeterminer(_sdk.version, 'module'), {
					action: [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`],
					search: [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`],
					universal: [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`],
					trigger: [`api`, `epoch`, `parameters`, `interface`, `samples`, `scope`],
					instant_trigger: [`api`, `parameters`, `interface`, `samples`],
					responder: [`api`, `parameters`, `expect`],
				}, 'imljson');
				app.functions = await parseComponent(validator, entries, app.metadata, Core.pathDeterminer(_sdk.version, 'function'), ['code', 'test'], 'js', false);
				return app;

				// validator.count should equal entries.length;
			};

			const buildRequestQueue = (app, remoteApp) => {
				const requests = [];

				requests.push(makeRequestProto(`Base`, `${remoteApp.name}/${remoteApp.version}/base`, 'PUT', 'application/jsonc', app.base));
				requests.push(makeRequestProto(`Readme`, `${remoteApp.name}/${remoteApp.version}/readme`, 'PUT', 'text/markdown', app.readme));

				if (app.icon !== undefined) {
					requests.push(makeRequestProto(`Icon`, `${remoteApp.name}/${remoteApp.version}/icon`, 'PUT', 'image/png', app.icon));
				}

				app.connections.forEach((connection) => {
					requests.push(makeRequestProto(`Connection ${connection.metadata.label}`, `${remoteApp.name}/${Core.pathDeterminer(_environment.version, 'connection')}`, 'POST', 'application/json',
						JSON.stringify(extract(connection.metadata, ['label', 'type'])),
						[
							{
								key: 'name',
								slug: '#CONN_NAME#'
							},
							{
								key: 'name',
								slug: `connection-${connection.metadata.name}`
							}
						]));
					[`api`, `parameters`].forEach(code => {
						requests.push(makeRequestProto(`Connection ${connection.metadata.label} - ${code}`,
							`${_environment.version !== 2 ? `${remoteApp.name}/` : ''}${Core.pathDeterminer(_environment.version, 'connection')}/#CONN_NAME#/${code}`, 'PUT', 'application/jsonc', connection[code]));
					});
					[`scope`, `scopes`].forEach(code => {
						requests.push(makeRequestProto(`Connection ${connection.metadata.label} - ${code}`,
							`${_environment.version !== 2 ? `${remoteApp.name}/` : ''}${Core.pathDeterminer(_environment.version, 'connection')}/#CONN_NAME#/${code}`, 'PUT', 'application/jsonc', connection[code]));
					});
				});

				app.rpcs.forEach((rpc) => {
					requests.push(makeRequestProto(`RPC ${rpc.metadata.label}`,
						`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'rpc')}`, 'POST', 'application/json', JSON.stringify(rpc.metadata), undefined,
						[
							{
								key: 'connection',
								slug: `connection-${rpc.metadata.connection}`
							}
						]));
					[`api`, `parameters`].forEach(code => {
						requests.push(makeRequestProto(`RPC ${rpc.metadata.label} - ${code}`,
							`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'rpc')}/${rpc.metadata.name}/${code}`, 'PUT', 'application/jsonc', rpc[code]));
					});
				});

				app.webhooks.forEach((webhook) => {
					requests.push(makeRequestProto(`Webhook ${webhook.metadata.label}`,
						`${remoteApp.name}/${Core.pathDeterminer(_environment.version, 'webhook')}`, 'POST', 'application/json', JSON.stringify(extract(webhook.metadata,
							['label', 'type', 'connection'])),
						[
							{
								key: 'name',
								slug: '#WEBHOOK_NAME#'
							},
							{
								key: 'name',
								slug: `webhook-${webhook.metadata.name}`
							}
						],
						[
							{
								key: 'connection',
								slug: `connection-${webhook.metadata.connection}`
							}
						]));
					([`api`, `parameters`, `attach`, `detach`, `scope`].concat(_environment.version === 2 ? [`update`] : [])).forEach(code => {
						requests.push(makeRequestProto(`Webhook ${webhook.metadata.label} - ${code}`,
							`${_environment.version !== 2 ? `${remoteApp.name}/` : ''}${Core.pathDeterminer(_environment.version, 'webhook')}/#WEBHOOK_NAME#/${code}`, 'PUT', 'application/jsonc', webhook[code]));
					});
				});

				app.modules.forEach((appModule) => {
					const body = extract(appModule.metadata, ['label', 'connection', 'name', 'description', 'webhook', 'subtype']);
					switch (appModule.metadata.type) {
						case 'trigger':
							body.type_id = 1;
							break;
						case 'action':
							body.type_id = 4;
							break;
						case 'search':
							body.type_id = 9;
							break;
						case 'instant_trigger':
							body.type_id = 10;
							break;
						case 'responder':
							body.type_id = 11;
							break;
						case 'universal':
							body.type_id = 12;
							break;
					}
					requests.push(makeRequestProto(`Module ${appModule.metadata.label}`,
						`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'module')}`, 'POST', 'application/json', JSON.stringify(body), undefined,
						[
							{
								key: 'connection',
								slug: `connection-${appModule.metadata.connection}`
							},
							{
								key: 'webhook',
								slug: `webhook-${appModule.metadata.webhook}`
							}
						]));
					let codes;
					switch (body.type_id) {
						case 4:
						case 9:
						case 12:
							codes = [`api`, `parameters`, `expect`, `interface`, `samples`, `scope`];
							break;
						case 1:
							codes = [`api`, `epoch`, `parameters`, `interface`, `samples`, `scope`];
							break;
						case 10:
							codes = [`api`, `parameters`, `interface`, `samples`];
							break;
						case 11:
							codes = [`api`, `parameters`, `expect`];
							break;
					}
					codes.forEach(code => {
						requests.push(makeRequestProto(`Module ${appModule.metadata.label} - ${code}`,
							`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'module')}/${appModule.metadata.name}/${code}`,
							'PUT', 'application/jsonc', appModule[code]));
					});
				});

				app.functions.forEach(appFunction => {
					const functionName = /(?:function )(.+)(?:\()/.exec(appFunction.code)[1];
					requests.push(makeRequestProto(`Function ${functionName}`,
						`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'function')}`, 'POST', 'application/json', JSON.stringify({
							name: functionName
						})));
					[`code`, `test`].forEach(code => {
						requests.push(makeRequestProto(`Function ${functionName} - ${code}`,
							`${remoteApp.name}/${remoteApp.version}/${Core.pathDeterminer(_environment.version, 'function')}/${functionName}/${code}`,
							'PUT', 'application/javascript', appFunction[code]));
					});
				});
				return requests;

				// requests.length should equal entries.lenght - 1 (because app create preflight is not in queue)
			};

			const source = await vscode.window.showOpenDialog({
				filters: { 'IMT App Archive': ['zip'] },
				openLabel: 'Import',
				canSelectFolders: false,
				canSelectMany: false
			});
			if (!source || source.length === 0 || !source[0]) {
				vscode.window.showWarningMessage('No Archive specified.');
				return;
			}
			const zip = new AdmZip(source[0].fsPath);
			/** File names in ZIPed app */
			const entries = zip.getEntries();
			const app = await parseApp(entries);

			if (_environment.version === 2) {
				app.metadata.audience = ((!Array.isArray(app.metadata.countries) || app.metadata.countries.length === 0) ? 'global' : 'countries')
				if (app.metadata.audience === 'global') {
					delete app.metadata.countries;
				}
				delete app.metadata.version;
				if (!app.metadata.description) {
					app.metadata.description = `Imported app ${app.metadata.label}.`
				}
			}

			// Name prompt
			app.metadata.name = await vscode.window.showInputBox({
				prompt: 'Enter name of the imported app',
				value: app.metadata.name,
				validateInput: Validator.appName
			});
			if (!Core.isFilled('name', 'imported app', app.metadata.name, 'A')) {
				return;
			}

			let remoteApp = await Core.addEntity(_authorization, app.metadata, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}`);
			if (!remoteApp) {
				return;
			}
			if (_environment.version === 2) { remoteApp = remoteApp.app }

			/** API requests list to push all app parts to Make */
			const requests = buildRequestQueue(app, remoteApp);

			let shouldStop = false;
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: `Importing ${app.metadata.label}`,
				cancellable: true
			}, async (progress, token) => {

				token.onCancellationRequested(() => {
					vscode.window.showWarningMessage(`Import terminated.`);
					shouldStop = true;
				});
				progress.report({
					increment: 0
				});

				const store = {};
				for (const r of requests) {
					if (shouldStop) {
						return;
					}
					const uri = replaceSlugs(store, `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${r.endpoint}`);
					progress.report({
						increment: (100 / requests.length),
						message: r._label
					});

					let bodyProto = r.body;
					if (r._replaceInBody !== undefined) {
						bodyProto = JSON.parse(bodyProto);
						r._replaceInBody.forEach(replacement => {
							if (bodyProto[replacement.key]) {
								bodyProto[replacement.key] = store[replacement.slug];
							}
						});
						bodyProto = JSON.stringify(bodyProto);
					}
					/** @type {import('axios').AxiosRequestConfig} */
					const requestConfig = {
						url: uri,
						headers: {
							'Authorization': _authorization,
							'x-imt-apps-sdk-version': Meta.version,
							'content-type': r.type
						},
						method: r.method,
						data: bodyProto,
						transformRequest: (data) => (data),
						transformResponse: (data) => (data),
					};

					if (_environment.version === 2 && requestConfig.method === 'POST' && requestConfig.headers['content-type'] === 'application/json') {
						// TODO Check, if it is ok to send data to Axios stringified
						const j = JSON.parse(requestConfig.data);
						requestConfig.data = JSON.stringify(Object.keys(j).reduce((p, c) => {
							p[camelCase(c)] = j[c] === null ? undefined : j[c];
							return p;
						}, {}))
					}

					const axiosResponse = await axios(requestConfig);
					if (r._store !== undefined) {
						r._store.forEach(s => {
							let parsed = JSON.parse(axiosResponse.data);

							// Autoparse the nested object
							if (_environment.version === 2 && Object.keys(parsed).length === 1 && Object.keys(parsed)[0].startsWith('app')) {
								parsed = parsed[Object.keys(parsed)[0]];
							}

							store[s.slug] = parsed[s.key];
						});
					}
				}
			});
			appsProvider.refresh();
			vscode.window.showInformationMessage(`App "${app.metadata.label}" has been imported.`);
		}));

		/**
		 * Clone app
		 */
		vscode.commands.registerCommand('apps-sdk.app.clone', async (context) => {
			if (!Core.envGuard(_environment, [2]) || !Core.contextGuard(context)) { return; }

			// Form Data

			let form
			if (_admin === true) {
				form = await Felicia([
					{
						name: 'newName',
						label: 'New name',
						type: 'text',
						required: true,
						default: context.name,
						validate: {
							pattern: '^[a-z][0-9a-z-]+[0-9a-z]$',
							min: 3
						}
					},
					{
						name: 'newVersion',
						label: 'New version (Make sure that your account enables "Can create Apps without ID suffix" feature.)',
						type: 'number',
						required: true,
						default: context.version
					}
				]);
			}

			else {
				form = await Felicia([
					{
						name: 'newName',
						label: 'New name',
						type: 'text',
						required: true,
						default: context.name,
						validate: {
							pattern: '^[a-z][0-9a-z-]+[0-9a-z]$',
							min: 3
						}
					}
				]);

				form.newVersion = 1;
			}

			if (!form) {
				return;
			}

			const uri = `${_environment.baseUrl}/${Core.pathDeterminer(_environment.version, '__sdk')}${Core.pathDeterminer(_environment.version, 'app')}/${context.name}/${context.version}/clone`;
			try {
				await Core.addEntity(_authorization, form, uri);
				appsProvider.refresh();
			}
			catch (err) {
				showError(err);
			}

		});
	}
}

module.exports = AppCommands;
