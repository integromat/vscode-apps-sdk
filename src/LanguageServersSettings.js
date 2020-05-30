const vscode = require('vscode')
const vscode_languageclient = require("vscode-languageclient");

const path = require('path')

module.exports = {
	getJsonSchemas: function getSchemaAssociation() {
		let associations = {};
		vscode.extensions.all.forEach(extension => {
			let packageJSON = extension.packageJSON;
			if (packageJSON && packageJSON.contributes && packageJSON.contributes.jsonValidation) {
				let jsonValidation = packageJSON.contributes.jsonValidation;
				if (Array.isArray(jsonValidation)) {
					jsonValidation.forEach(jv => {
						let { fileMatch, url } = jv;
						if (fileMatch && url) {
							if (url[0] === '.' && url[1] === '/') {
								url = vscode.Uri.file(path.join(extension.extensionPath, url)).toString();
							}
							if (fileMatch[0] === '%') {
								fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
								fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
							} else if (typeof fileMatch === 'string' && fileMatch.charAt(0) !== '/' && !fileMatch.match(/\w+:\/\//)) {
								fileMatch = '/' + fileMatch;
							}
							let association = associations[fileMatch];
							if (!association) {
								association = [];
								associations[fileMatch] = association;
							}
							association.push(url);
						}
					});
				}
			}
		});
		return associations;
	},

	clientOptions: {
		documentSelector: [{ scheme: 'file', language: 'imljson' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	},

	debugOptions: {
		execArgv: ['--nolazy', '--inspect=6009']
	},

	buildServerOptions: function buildServerOptions(serverModule) {
		return {
			run: { module: serverModule, transport: vscode_languageclient.TransportKind.ipc },
			debug: {
				module: serverModule,
				transport: vscode_languageclient.TransportKind.ipc,
				options: this.debugOptions
			}
		};
	}
}