import * as path from 'node:path';
import * as vscode from 'vscode';
import { SchemaConfiguration } from 'vscode-json-languageservice';
import * as vscodeLanguageclient from 'vscode-languageclient/node';

// Type copied from `jsonServer.ts, which is the receiver of this this datatype.
type ISchemaAssociations = Record<string, string[]>;

export function getJsonSchemas(): ISchemaAssociations | SchemaConfiguration[] {
	const associations: ReturnType<typeof getJsonSchemas> = {};
	vscode.extensions.all.forEach((extension) => {
		const packageJSON = extension.packageJSON;
		if (packageJSON && packageJSON.contributes && packageJSON.contributes.jsonValidation) {
			const jsonValidation = packageJSON.contributes.jsonValidation;
			if (Array.isArray(jsonValidation)) {
				jsonValidation.forEach((jv) => {
					let { fileMatch, url } = jv;
					if (fileMatch && url) {
						if (url[0] === '.' && url[1] === '/') {
							url = vscode.Uri.file(path.join(extension.extensionPath, url)).toString();
						}
						if (fileMatch[0] === '%') {
							fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
							fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
						} else if (
							typeof fileMatch === 'string' &&
							fileMatch.charAt(0) !== '/' &&
							!fileMatch.match(/\w+:\/\//)
						) {
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
}

export const clientOptions = {
	documentSelector: [{ scheme: 'file', language: 'imljson' }],
	synchronize: {
		fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
	},
};

export function buildServerOptions(serverModule: string) {
	const debugOptions = {
		execArgv: ['--nolazy', '--inspect=6009'],
	};

	return {
		run: { module: serverModule, transport: vscodeLanguageclient.TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: vscodeLanguageclient.TransportKind.ipc,
			options: debugOptions,
		},
	};
}
