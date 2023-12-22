import * as path from 'node:path';
import * as vscode from 'vscode';
import { SchemaConfiguration } from 'vscode-json-languageservice';
import * as vscodeLanguageclient from 'vscode-languageclient/node';

/**
 * Gets all JSON schemas definitions specified in this extensions
 * in the `package.json` -> `contributes` -> `jsonValidation`
 * and converts it into `SchemaConfiguration[]` datatype.
 */
export function getJsonSchemas(): SchemaConfiguration[] {
	const extension = vscode.extensions.getExtension('Integromat.apps-sdk')!;

	const jsonValidation: { fileMatch: string | string[]; url: string}[] =
		extension?.packageJSON?.contributes?.jsonValidation ?? [];
	if (!Array.isArray(jsonValidation)) {
		throw new Error('package.json -> contributes -> jsonValidation must be an array.');
	}

	return jsonValidation.map((jsonValidationItem) => {
		const originalFileMatches: string[] = Array.isArray(jsonValidationItem.fileMatch)
			? jsonValidationItem.fileMatch
			: [jsonValidationItem.fileMatch];

		let uri = jsonValidationItem.url;
		if (uri.startsWith('./')) {
			uri = vscode.Uri.file(path.join(extension.extensionPath, uri)).toString();
		}

		const finalFileMatches = originalFileMatches.map((fileMatch) => {
			if (fileMatch.startsWith('%')) {
				fileMatch = fileMatch.replace(/%APP_SETTINGS_HOME%/, '/User');
				fileMatch = fileMatch.replace(/%APP_WORKSPACES_HOME%/, '/Workspaces');
			} else if (
				typeof fileMatch === 'string' &&
				fileMatch.startsWith('/') &&
				!(/\w+:\/\//.test(fileMatch))
			) {
				fileMatch = '/' + fileMatch;  // TODO Is it needed to add "/"?
			}
			return fileMatch;
		});

		return {
			uri,
			fileMatch: finalFileMatches
		};
	});
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
